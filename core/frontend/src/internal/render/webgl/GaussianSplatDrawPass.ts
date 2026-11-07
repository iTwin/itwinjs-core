/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { dispose, expectDefined, Logger } from "@itwin/core-bentley";
import { Range2d, Range3d } from "@itwin/core-geometry";
import { RenderType } from "@itwin/webgl-compatibility";
import { FrontendLoggerCategory } from "../../../common/FrontendLoggerCategory";
import { RenderMemory } from "../../../render/RenderMemory";
import {
  buildGaussianSplatPageTable, GaussianSplatDrawnTile, GaussianSplatLogicalLayout, gaussianSplatPageTableTexelWords, gaussianSplatPageTableWidth,
  isSameGaussianSplatOccurrence,
} from "../GaussianSplatInstances";
import { CachedGeometry } from "./CachedGeometry";
import { DrawParams, ShaderProgramParams } from "./DrawCommand";
import { FrameBuffer } from "./FrameBuffer";
import { GaussianSplatAtlas } from "./GaussianSplatAtlas";
import { GaussianSplatField } from "./GaussianSplatField";
import {
  GaussianSplatColorFieldGeometry, GaussianSplatDrawGeometry, gaussianSplatTechniques,
} from "./GaussianSplatPrograms";
import { gaussianSplatMaxSigmaCssPixels } from "./glsl/GaussianSplats";
import {
  GaussianSplatColorSpace, gaussianSplatTileMetadata, GaussianSplatVisibleTile, isLinearTrained, writeGaussianSplatTileMetadata,
} from "./GaussianSplatVisibleTiles";
import { GL } from "./GL";
import { RenderPass } from "./RenderFlags";
import { RenderState } from "./RenderState";
import { System } from "./System";
import { Target } from "./Target";
import { TextureHandle } from "./Texture";

const noPages: readonly number[] = [];

/** `values` if it holds at least `length` values, else a larger array: twice as large, or `length` if more. */
function withCapacity(values: Float32Array, length: number): Float32Array {
  return values.length >= length ? values : new Float32Array(Math.max(length, 2 * values.length));
}

/** Hidden page-table occurrences are logged at most this often, with the count since the last report. */
const pageReportIntervalMs = 10_000;

/** Occurrences the page table hid since the last report, and when that report was logged. */
interface HiddenOccurrenceReport {
  mismatched: number;
  nonResident: number;
  builds: number;
  loggedAt: number;
  flush?: ReturnType<typeof setTimeout>;
}

/** The color field linear-trained splats are blended into, and its fill and composite passes. */
interface ColorField {
  texture: TextureHandle;
  fbo: FrameBuffer;
  fill: GaussianSplatColorFieldGeometry;
  composite: GaussianSplatColorFieldGeometry;
}

/** A rectangle of window pixels from the lower left, as gl.scissor takes it: x, y, width, height. */
type WindowRect = [number, number, number, number];

/** One viewport's GPU draw of its sorted splats: the draw geometry holding the displayed order and the per-frame tile metadata,
 * clip plane and page table textures, and, while linear-trained splats are drawn, the color field they are blended into before
 * it is composited onto the frame. The splat techniques (the render system's) and the atlas holding the splats are shared by all
 * viewports.
 * @internal
 */
export class GaussianSplatDrawPass implements Disposable {
  private readonly _drawState = new RenderState();
  /** Fills the color field from the frame: no blending. */
  private readonly _fillState = new RenderState();
  /** Composites the color field onto the frame (see [[drawColor]]). */
  private readonly _compositeState = new RenderState();
  private readonly _programParams = new ShaderProgramParams();
  private readonly _drawParams = new DrawParams();
  private _geometry?: GaussianSplatDrawGeometry;
  private _colorField?: ColorField;
  /** What the uploaded page table was built from: atlas page arrays are replaced, never mutated, when a tile moves. */
  private _pageTableSource?: { layout: GaussianSplatLogicalLayout, tiles: GaussianSplatDrawnTile[] };
  private _pageTableWords?: Uint32Array;
  /** CPU staging of the tile metadata and clip planes, reused from frame to frame. */
  private _metadataValues = new Float32Array(0);
  private _planeValues = new Float32Array(0);
  private _instanceBytes = 0;
  private _hiddenOccurrences: HiddenOccurrenceReport = { mismatched: 0, nonResident: 0, builds: 0, loggedAt: -Infinity };

  public constructor(private readonly _target: Target, private readonly _atlas: GaussianSplatAtlas) {
    this._drawState.flags.depthTest = true;
    this._drawState.flags.depthMask = false;
    this._drawState.flags.blend = true;
    this._drawState.blend.setBlendFunc(GL.BlendFactor.One, GL.BlendFactor.OneMinusSrcAlpha);
    this._fillState.flags.depthMask = false;
    this._compositeState.flags.depthMask = false;
    this._compositeState.flags.blend = true;
    this._compositeState.blend.setBlendFuncSeparate(GL.BlendFactor.One, GL.BlendFactor.One, GL.BlendFactor.Zero, GL.BlendFactor.OneMinusSrcAlpha);
  }

  /** The page table hid occurrences: the rest of the field is drawn. Logged at once, then at most once per
   * [[pageReportIntervalMs]] with what was hidden since the last report, so that a later, unrelated slip is not silent. */
  private reportHiddenOccurrences(mismatched: number, nonResident: number): void {
    const report = this._hiddenOccurrences;
    report.mismatched += mismatched;
    report.nonResident += nonResident;
    report.builds++;

    const wait = report.loggedAt + pageReportIntervalMs - performance.now();
    if (wait <= 0)
      this.logHiddenOccurrences();
    else if (!report.flush)
      report.flush = setTimeout(() => this.logHiddenOccurrences(), wait);
  }

  public logHiddenOccurrences(): void {
    const report = this._hiddenOccurrences;
    if (report.flush)
      clearTimeout(report.flush);
    if (report.builds === 0)
      return;

    const parts = [];
    if (report.mismatched)
      parts.push(`${report.mismatched} whose atlas pages do not match their logical pages (a bookkeeping error)`);
    if (report.nonResident)
      parts.push(`${report.nonResident} whose tile has no atlas pages (not resident)`);

    Logger.logError(FrontendLoggerCategory.Render, `Gaussian splats: hid sorted tile occurrences in ${report.builds} page table build(s): ${parts.join("; ")}`);
    this._hiddenOccurrences = { mismatched: 0, nonResident: 0, builds: 0, loggedAt: performance.now() };
  }

  /** Pair the displayed order with this frame's tile rows. Rebuilt only when the order's layout, the drawn rows or
   * their atlas rows change: O(logical pages), never O(splats).
   */
  private uploadPageTable(geometry: GaussianSplatDrawGeometry, tiles: GaussianSplatVisibleTile[], layout: GaussianSplatLogicalLayout): void {
    // A tile that is not resident has no pages; the table hides it rather than failing the field.
    const drawn = tiles.map((tile) => ({ occurrence: tile.occurrence, count: tile.geometry.splats.count, pages: this._atlas.residentPages(tile.geometry.id) ?? noPages }));
    const source = this._pageTableSource;
    const unchanged = source?.layout === layout && source.tiles.length === drawn.length
      && source.tiles.every((tile, row) => tile.pages === drawn[row].pages && isSameGaussianSplatOccurrence(tile.occurrence, drawn[row].occurrence));
    if (unchanged)
      return;

    const { words, mismatched, nonResident } = buildGaussianSplatPageTable(layout, drawn, this._pageTableWords);
    if (mismatched > 0 || nonResident > 0)
      this.reportHiddenOccurrences(mismatched, nonResident);

    const rows = words.length / gaussianSplatPageTableTexelWords / gaussianSplatPageTableWidth;
    if (rows > System.instance.maxTextureSize)
      throw new Error("Gaussian splats: too many logical pages for the page table");

    this._pageTableWords = words;
    geometry.pageTable.upload(words, rows);
    this._pageTableSource = { layout, tiles: drawn };
  }

  /** Create the draw geometry if needed, and upload this frame's tile metadata and clip planes, the page table and the field's
   * displayed order. */
  public upload(tiles: GaussianSplatVisibleTile[], field: GaussianSplatField): void {
    const geometry = this._geometry ??= new GaussianSplatDrawGeometry();
    const clipStack = this._target.uniforms.branch.clipStack;
    const clipColors = { inside: clipStack.insideColor, outside: clipStack.outsideColor };
    const clipPlaneCounts = tiles.map((tile) => clipStack.planeCountWith(tile.clips));
    const metadataRows = Math.max(1, tiles.length);
    const planeRows = Math.max(1, clipPlaneCounts.reduce((sum, count) => sum + count, 0));
    if (metadataRows > System.instance.maxTextureSize || planeRows > System.instance.maxTextureSize)
      throw new Error("Gaussian splats: too many visible tile instances or clip planes");

    const metadata = this._metadataValues = withCapacity(this._metadataValues, metadataRows * gaussianSplatTileMetadata.length);
    const planes = this._planeValues = withCapacity(this._planeValues, planeRows * 4);
    let firstClipPlane = 0;
    for (const [row, tile] of tiles.entries()) {
      // Packed higher-band SH: a splat's index within its tile comes from the page table, so the tile's atlas rows need not be
      // contiguous. Metadata is float32, exact only for integers up to 2^24.
      const firstShTexel = this._atlas.auxiliaryOffset(tile.geometry.id) / 4;
      if (firstShTexel >= 2 ** 24)
        throw new Error("Gaussian splats: atlas offset exceeds the exact float32 metadata range");

      const clipPlaneCount = clipPlaneCounts[row];
      clipStack.writePlanesWith(tile.clips, planes, firstClipPlane);
      writeGaussianSplatTileMetadata(tile, clipColors, { firstClipPlane, clipPlaneCount, firstShTexel }, metadata, row * gaussianSplatTileMetadata.length);
      firstClipPlane += clipPlaneCount;
    }

    geometry.metadata.upload(metadata, metadataRows);
    geometry.planes.upload(planes, planeRows);
    this.uploadPageTable(geometry, tiles, field.instanceLayout);
    geometry.splats = this._atlas.texture;
    geometry.auxiliary = this._atlas.auxiliaryTexture;

    if (field.instancesDirty) {
      geometry.uploadInstances(field.instances);
      field.markInstancesUploaded();
    }

    geometry.instanceCount = field.instances.length;
    this._instanceBytes = field.instances.byteLength;
  }

  /** Compile the splat techniques' programs, so that a program that fails to compile throws before any framebuffer is bound. */
  private compilePrograms(): void {
    const techniques = this._target.techniques;
    const { splats, fill, composite } = gaussianSplatTechniques(techniques);
    const compiled = [splats, fill, composite].every((id) => techniques.getTechnique(id).compileShaders());
    if (!compiled)
      throw new Error("Gaussian splats: shader programs failed to compile");
  }

  /** Draw `geometry` with its technique. */
  private drawTechnique(geometry: CachedGeometry): void {
    this._programParams.init(this._target, RenderPass.GaussianSplats);
    this._drawParams.init(this._programParams, geometry);
    this._target.techniques.draw(this._drawParams);
  }

  /** The color field linear splats are blended into, matching `destination`'s size and depth buffer. */
  private colorFieldFor(destination: FrameBuffer): ColorField {
    const { width, height } = this._target.viewRect;
    const field = this._colorField;
    if (field?.texture.width === width && field.texture.height === height && field.fbo.depthBuffer === destination.depthBuffer)
      return field;

    this.disposeColorField();
    // Half float keeps dark linear values without 32-bit float's doubled blend bandwidth. The render system's capabilities tell
    // whether float color buffers are renderable (with EXT_color_buffer_float, unless the application disabled it); blending
    // into RGBA16F needs nothing more.
    const system = System.instance;
    const dataType = system.maxRenderType === RenderType.TextureUnsignedByte ? GL.Texture.DataType.UnsignedByte : system.context.HALF_FLOAT;
    const texture = TextureHandle.createForAttachment(width, height, GL.Texture.Format.Rgba, dataType);
    const fbo = texture && FrameBuffer.create([texture], destination.depthBuffer);
    const techniques = gaussianSplatTechniques(system.techniques);
    const fill = fbo && GaussianSplatColorFieldGeometry.createColorField(expectDefined(texture.getHandle()), techniques.fill);
    const composite = fill && GaussianSplatColorFieldGeometry.createColorField(expectDefined(texture.getHandle()), techniques.composite);
    if (!texture || !fbo || !fill || !composite) {
      dispose(composite);
      dispose(fill);
      dispose(fbo);
      dispose(texture);
      throw new Error("Gaussian splats: failed to create color framebuffer");
    }

    return this._colorField = { texture, fbo, fill, composite };
  }

  private disposeColorField(): void {
    const field = this._colorField;
    if (!field)
      return;

    dispose(field.composite);
    dispose(field.fill);
    dispose(field.fbo);
    dispose(field.texture);
    this._colorField = undefined;
  }

  /** The window rectangle outside which no splat of `tiles` is drawn: the projected bounds of their means, widened by the
   * largest splat radius. Undefined if some tile reaches behind the near plane.
   */
  private splatScissor(tiles: GaussianSplatVisibleTile[]): WindowRect | undefined {
    const eyeRange = Range3d.createNull();
    for (const tile of tiles)
      eyeRange.extendRange(tile.eyeRange);

    const { projectionMatrix, nearPlane } = this._target.uniforms.frustum;
    if (eyeRange.isNull || eyeRange.high.z > -nearPlane)
      return undefined;

    const { width, height } = this._target.viewRect;
    const pixels = Range2d.createNull();
    for (const corner of eyeRange.corners()) {
      const clip = projectionMatrix.multiplyPoint3d(corner, 1);
      pixels.extendXY((clip.x / clip.w + 1) * width / 2, (clip.y / clip.w + 1) * height / 2);
    }

    const margin = 3 * gaussianSplatMaxSigmaCssPixels * this._target.devicePixelRatio;
    const left = Math.max(0, Math.floor(pixels.low.x - margin)), bottom = Math.max(0, Math.floor(pixels.low.y - margin));
    const right = Math.min(width, Math.ceil(pixels.high.x + margin)), top = Math.min(height, Math.ceil(pixels.high.y + margin));
    return [left, bottom, Math.max(0, right - left), Math.max(0, top - bottom)];
  }

  /** Blend the display-space (sRGB) splats straight into `destination`'s single-sample buffers, as the frame's own colors are:
   * premultiplied, back to front, depth-tested against the frame's depth. Pixels no splat was drawn at keep their color.
   */
  private blendIntoFrame(geometry: GaussianSplatDrawGeometry, destination: FrameBuffer): void {
    const system = System.instance;
    geometry.colorSpace = GaussianSplatColorSpace.Display;
    system.frameBufferStack.execute(destination, true, false, () => {
      system.applyRenderState(this._drawState);
      this.drawTechnique(geometry);
    });
  }

  /** Blend the linear splats through the color field, since splats trained in linear space must blend with the frame in linear
   * space, which blending into the frame cannot do:
   * 1. fill the field with the frame's color, converted to linear space, and alpha 0;
   * 2. blend the splats into it (premultiplied, back to front), depth-tested against the frame's depth: the field's color is
   *    then the splats over the frame, and its alpha their coverage;
   * 3. composite it onto the frame where its alpha is not 0: the clamped color, converted to display space, replaces the
   *    frame's color, and the coverage is blended over the frame's alpha.
   * Pixels no splat was drawn at are discarded in step 3, so the frame keeps them exactly. Where splats were drawn, the color
   * is computed in the field's precision (half float, or 8 bits without float color buffers). The full-screen fill and
   * composite are limited to `scissor`, if defined.
   */
  private blendThroughColorField(geometry: GaussianSplatDrawGeometry, destination: FrameBuffer, scissor?: WindowRect): void {
    const system = System.instance;
    const gl = system.context;
    const colorField = this.colorFieldFor(destination);
    colorField.fill.texture = expectDefined(destination.getColor(0).getHandle());
    geometry.colorSpace = GaussianSplatColorSpace.Linear;
    if (scissor) {
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(...scissor);
    }

    try {
      system.frameBufferStack.execute(colorField.fbo, true, false, () => {
        system.applyRenderState(this._fillState);
        this.drawTechnique(colorField.fill);
        system.applyRenderState(this._drawState);
        this.drawTechnique(geometry);
      });
      system.frameBufferStack.execute(destination, true, false, () => {
        system.applyRenderState(this._compositeState);
        this.drawTechnique(colorField.composite);
      });
    } finally {
      gl.disable(gl.SCISSOR_TEST);
    }
  }

  /** Draw the uploaded order onto `destination`: splats trained in display space straight into it, then those trained in linear
   * space through the color field. The color field exists only while linear splats are drawn. A multisampled frame is resolved
   * first and the splats are drawn into its single-sample buffers, which the rest of the frame is composed from: blending them
   * per sample made a 4x multisampled frame of Redmond's detail pose about five times as expensive on the GPU.
   */
  public drawColor(tiles: GaussianSplatVisibleTile[], destination: FrameBuffer, multisampled: boolean): void {
    const geometry = this._geometry;
    if (!geometry)
      return;

    this.compilePrograms();
    const { width, height } = this._target.viewRect;
    System.instance.context.viewport(0, 0, width, height);
    if (multisampled)
      destination.blitMsBuffersToTextures(true);

    const linearTiles = tiles.filter((tile) => isLinearTrained(tile));
    if (linearTiles.length < tiles.length)
      this.blendIntoFrame(geometry, destination);

    if (linearTiles.length)
      this.blendThroughColorField(geometry, destination, this.splatScissor(linearTiles));
    else
      this.disposeColorField();
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    stats.addInstances(this._instanceBytes);
    this._geometry?.collectStatistics(stats);
    if (this._colorField)
      stats.addTextureAttachment(this._colorField.texture.bytesUsed);
  }

  public [Symbol.dispose](): void {
    this.disposeColorField();
    this._geometry = dispose(this._geometry);
    this._pageTableSource = undefined;
  }
}
