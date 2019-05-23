/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { dispose, assert } from "@bentley/bentleyjs-core";
import { ClipVector, Point3d, ClipUtilities, Triangulator, PolyfaceBuilder, IndexedPolyfaceVisitor, UnionOfConvexClipPlaneSets, Vector3d, StrokeOptions, Transform } from "@bentley/geometry-core";
import { QPoint3dList, Frustum, QParams3d } from "@bentley/imodeljs-common";
import { ShaderProgramExecutor } from "./ShaderProgram";
import { Target } from "./Target";
import { RenderMemory, RenderClipVolume, ClippingType } from "../System";
import { ClipMaskGeometry } from "./CachedGeometry";
import { ViewRect } from "../../Viewport";
import { FrameBuffer } from "./FrameBuffer";
import { TextureHandle, Texture2DData, Texture2DHandle } from "./Texture";
import { GL } from "./GL";
import { System } from "./System";
import { RenderState } from "./RenderState";
import { DrawParams } from "./DrawCommand";

/** @internal */
interface ClipPlaneSets {
  readonly planes: UnionOfConvexClipPlaneSets;
  readonly numPlanes: number;
  readonly numSets: number;
}

/** @internal */
interface ClipPlaneTexture {
  readonly handle: Texture2DHandle;
  readonly data: Texture2DData;
}

/** Maintains a texture representing clipping planes. Updated when view matrix changes.
 * @internal
 */
abstract class ClippingPlanes {
  /** Most recently-applied view matrix. */
  private readonly _transform = Transform.createZero();
  private readonly _texture: ClipPlaneTexture;
  private readonly _planes: ClipPlaneSets;
  /** Used for writing to texture data. */
  private readonly _view: DataView;
  /** Position at which to write next texture data. */
  private _curPos: number = 0;

  public static create(planes: ClipPlaneSets): ClippingPlanes | undefined {
    return System.instance.capabilities.supportsTextureFloat ? FloatPlanes.create(planes) : PackedPlanes.create(planes);
  }

  public dispose(): void {
    dispose(this._texture.handle);
  }

  public get bytesUsed(): number { return this._texture.handle.bytesUsed; }

  public getTexture(transform: Transform): Texture2DHandle {
    if (transform.isAlmostEqual(this._transform))
      return this._texture.handle;

    this.reset();
    transform.clone(this._transform);

    // Avoid allocations inside loop...
    const pInwardNormal = new Vector3d();
    const dir = new Vector3d();
    const pos = new Point3d();
    const v0 = new Vector3d();

    let numSetsProcessed = 0;
    for (const set of this._planes.planes.convexSets) {
      if (set.planes.length === 0)
        continue;

      for (const plane of set.planes) {
        plane.inwardNormalRef.clone(pInwardNormal);
        let pDistance = plane.distance;

        // Transform direction of clip plane
        const norm = pInwardNormal;
        transform.matrix.multiplyVector(norm, dir);
        dir.normalizeInPlace();

        // Transform distance of clip plane
        transform.multiplyPoint3d(norm.scale(pDistance, v0), pos);
        v0.setFromPoint3d(pos);

        pInwardNormal.set(dir.x, dir.y, dir.z);
        pDistance = -v0.dotProduct(dir);

        // The plane has been transformed into view space
        this.appendPlane(pInwardNormal, pDistance);
      }

      if (++numSetsProcessed < this._planes.numSets)
        this.appendZeroPlane();
    }

    this._texture.handle.replaceTextureData(this._texture.data);
    return this._texture.handle;
  }

  /** Exposed for testing purposes. */
  public getTextureData(transform: Transform): Texture2DData {
    this.getTexture(transform);
    return this._texture.data;
  }

  protected constructor(planes: ClipPlaneSets, texture: ClipPlaneTexture) {
    this._texture = texture;
    this._planes = planes;
    this._view = new DataView(texture.data.buffer);
  }

  protected abstract append(value: number): void;

  protected appendFloat(value: number): void { this._view.setFloat32(this._curPos, value, true); this.advance(4); }
  protected appendUint8(value: number): void { this._view.setUint8(this._curPos, value); this.advance(1); }

  private advance(numBytes: number): void { this._curPos += numBytes; }
  private reset(): void { this._curPos = 0; }

  private appendValues(a: number, b: number, c: number, d: number) {
    this.append(a);
    this.append(b);
    this.append(c);
    this.append(d);
  }

  private appendPlane(normal: Vector3d, distance: number): void { this.appendValues(normal.x, normal.y, normal.z, distance); }
  private appendZeroPlane(): void { this.appendValues(0, 0, 0, 0); }
}

/** Stores clip planes in floating-point texture.
 * @internal
 */
class FloatPlanes extends ClippingPlanes {
  public static create(planes: ClipPlaneSets): ClippingPlanes | undefined {
    const totalNumPlanes = planes.numPlanes + planes.numSets - 1;
    const data = new Float32Array(totalNumPlanes * 4);
    const handle = Texture2DHandle.createForData(1, totalNumPlanes, data, false, GL.Texture.WrapMode.ClampToEdge, GL.Texture.Format.Rgba);
    return undefined !== handle ? new FloatPlanes(planes, { handle, data }) : undefined;
  }

  protected append(value: number) { this.appendFloat(value); }

  private constructor(planes: ClipPlaneSets, texture: ClipPlaneTexture) { super(planes, texture); }
}

/** Stores clip planes packed into RGBA texture.
 * @internal
 */
class PackedPlanes extends ClippingPlanes {
  public static create(planes: ClipPlaneSets): ClippingPlanes | undefined {
    const totalNumPlanes = planes.numPlanes + planes.numSets - 1;
    const data = new Uint8Array(totalNumPlanes * 4 * 4);
    const handle = Texture2DHandle.createForData(4, totalNumPlanes, data, false, GL.Texture.WrapMode.ClampToEdge, GL.Texture.Format.Rgba);
    return undefined !== handle ? new PackedPlanes(planes, { handle, data }) : undefined;
  }

  protected append(value: number) {
    const sign = value < 0 ? 1 : 0;
    value = Math.abs(value);
    const exponent = Math.floor(Math.log10(value)) + 1;
    value = value / Math.pow(10, exponent);

    const bias = 38;
    let temp = value * 256;
    const b0 = Math.floor(temp);
    temp = (temp - b0) * 256;
    const b1 = Math.floor(temp);
    temp = (temp - b1) * 256;
    const b2 = Math.floor(temp);
    const b3 = (exponent + bias) * 2 + sign;

    this.appendUint8(b0);
    this.appendUint8(b1);
    this.appendUint8(b2);
    this.appendUint8(b3);
  }

  private constructor(planes: ClipPlaneSets, texture: ClipPlaneTexture) { super(planes, texture); }
}

/** A 3D clip volume defined as a texture derived from a set of planes.
 * @internal
 */
export class ClipPlanesVolume extends RenderClipVolume implements RenderMemory.Consumer {
  private _planes?: ClippingPlanes; // not read-only because dispose()...

  private constructor(clip: ClipVector, planes?: ClippingPlanes) {
    super(clip);
    this._planes = planes;
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    if (undefined !== this._planes)
      stats.addClipVolume(this._planes.bytesUsed);
  }

  public get type(): ClippingType { return ClippingType.Planes; }

  /** Create a new ClipPlanesVolume from a ClipVector.
   * * The result is undefined if
   *   * (a) there is more than one clipper
   *   * (b) the clipper does not have clipPlaneSet (for instance, a pure mask clipper has mask planes but not primary clip planes)
   */
  public static create(clipVec: ClipVector): ClipPlanesVolume | undefined {
    if (1 !== clipVec.clips.length)
      return undefined;

    const clipPrim = clipVec.clips[0];
    const clipPlaneSet = clipPrim.fetchClipPlanesRef();
    return undefined !== clipPlaneSet ? ClipPlanesVolume.createFromClipPlaneSet(clipPlaneSet, clipVec) : undefined;
  }

  private static createFromClipPlaneSet(clipPlaneSet: UnionOfConvexClipPlaneSets, clip: ClipVector) {
    let numPlanes = 0;
    let numSets = 0;
    for (const set of clipPlaneSet.convexSets) {
      const setLength = set.planes.length;
      if (setLength !== 0) {
        numSets++;
        numPlanes += setLength;
      }
    }
    if (numPlanes === 0)
      return undefined;

    const planes = ClippingPlanes.create({ planes: clipPlaneSet, numPlanes, numSets });
    return new ClipPlanesVolume(clip, planes);
  }

  public dispose() {
    this._planes = dispose(this._planes);
  }

  /** Push this ClipPlanesVolume clipping onto a target. */
  public pushToTarget(target: Target) {
    if (undefined !== this._planes) {
      const texture = this._planes.getTexture(target.viewMatrix);
      target.clips.set(texture.height, texture);
    }
  }

  /** Push this ClipPlanesVolume clipping onto the target of a shader program executor. */
  public pushToShaderExecutor(shader: ShaderProgramExecutor) {
    this.pushToTarget(shader.target);
  }

  /** Pop this ClipPlanesVolume clipping from a target. */
  public pop(target: Target) {
    target.clips.clear();
  }

  /** Exposed for testing purposes. */
  public getTextureData(transform = Transform.identity): Float32Array | Uint8Array | undefined {
    return undefined !== this._planes ? this._planes.getTextureData(transform) : undefined;
  }
}

/** A 2D clip volume defined as a texture derived from a masked set of planes.
 * @internal
 */
export class ClipMaskVolume extends RenderClipVolume implements RenderMemory.Consumer {
  public readonly geometry: ClipMaskGeometry;
  public readonly frustum: Frustum;
  public readonly rect: ViewRect;
  private _texture?: TextureHandle;
  private _fbo?: FrameBuffer;

  private constructor(geometry: ClipMaskGeometry, clip: ClipVector) {
    super(clip);
    this.geometry = geometry;
    this.frustum = new Frustum();
    this.rect = new ViewRect(0, 0, 0, 0);
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    this.geometry.collectStatistics(stats);
    if (undefined !== this._texture)
      stats.addClipVolume(this._texture.bytesUsed);
  }

  public get type(): ClippingType { return ClippingType.Mask; }

  /** Create a new ClipMaskVolume from a clip vector. */
  public static create(clipVec: ClipVector): ClipMaskVolume | undefined {
    const range = clipVec.boundingRange;
    if (range.isNull)
      return undefined;

    const pts: Point3d[] = [
      Point3d.create(range.low.x, range.low.y, 0),
      Point3d.create(range.high.x, range.low.y, 0),
      Point3d.create(range.high.x, range.high.y, 0),
      Point3d.create(range.low.x, range.high.y, 0),
    ];

    // Clip the polygon into smaller polygons inside the clipping region
    const clippedPolygonInsides = ClipUtilities.clipPolygonToClipShape(pts, clipVec.clips[0]);  // ### TODO: Currently assume that there is only one shape...
    const indices: number[] = [];
    const vertices = QPoint3dList.createFrom([], QParams3d.fromRange(range));

    const strokeOptions = new StrokeOptions();
    strokeOptions.shouldTriangulate = true;
    const polyfaceBuilder = PolyfaceBuilder.create(strokeOptions);
    for (const clippedPolygon of clippedPolygonInsides) {
      if (clippedPolygon.length < 3) {
        continue;
      } else if (clippedPolygon.length === 3) {
        polyfaceBuilder.addTriangleFacet(clippedPolygon);

      } else if (clippedPolygon.length === 4) {
        polyfaceBuilder.addQuadFacet(clippedPolygon);

      } else if (clippedPolygon.length > 4) {
        // Clipped polygon must be triangulated before appending
        const triangulatedPolygonGraph = Triangulator.createTriangulatedGraphFromSingleLoop(clippedPolygon);
        Triangulator.flipTriangles(triangulatedPolygonGraph);
        polyfaceBuilder.addGraph(triangulatedPolygonGraph, false);
      }
    }
    const polyface = polyfaceBuilder.claimPolyface();
    const nPoints = polyface.pointCount;
    const pPoints = polyface.data.point;
    assert(nPoints !== 0);

    for (let i = 0; i < nPoints; i++)
      vertices.add(pPoints.getPoint3dAtUncheckedPointIndex(i));

    const visitor = IndexedPolyfaceVisitor.create(polyface, 0);
    while (visitor.moveToNextFacet())
      for (let i = 0; i < 3; i++)
        indices.push(visitor.clientPointIndex(i));

    assert(indices.length > 0);
    if (indices.length === 0 || vertices.length === 0)
      return undefined;

    return new ClipMaskVolume(new ClipMaskGeometry(new Uint32Array(indices), vertices), clipVec);
  }

  public get texture(): TextureHandle | undefined { return this._texture; }
  public get fbo(): FrameBuffer | undefined { return this._fbo; }

  public dispose() {
    this._texture = dispose(this._texture);
    this._fbo = dispose(this._fbo);
  }

  /** Push this ClipMaskVolume clipping onto a target. */
  public pushToTarget(_target: Target) { assert(false); }

  /** Push this ClipMaskVolume clipping onto the target of a program executor. */
  public pushToShaderExecutor(shader: ShaderProgramExecutor) {
    const texture = this.getTexture(shader);
    if (texture !== undefined)
      shader.target.clipMask = texture;
  }

  /** Pop this ClipMaskVolume clipping from a target. */
  public pop(target: Target) {
    if (target.is2d && this._texture !== undefined)
      target.clipMask = undefined;
  }

  /** Update the clip mask using the shader executor's target and return the resulting texture. */
  public getTexture(exec: ShaderProgramExecutor): TextureHandle | undefined {
    const target = exec.target;
    if (!target.is2d)
      return undefined;

    const frust = target.planFrustum;
    const rect = target.viewRect;
    const frustumChanged = !this.frustum.equals(frust);
    const textureChanged = this._texture === undefined || this.rect.width !== rect.width || this.rect.height !== rect.height;

    if (textureChanged) {
      this.dispose();
      this._texture = TextureHandle.createForAttachment(rect.width, rect.height, GL.Texture.Format.Rgba, GL.Texture.DataType.UnsignedByte);
      if (this._texture !== undefined)
        this._fbo = FrameBuffer.create([this._texture]);
    }

    this.rect.init(rect.left, rect.top, rect.right, rect.bottom);
    if (textureChanged || frustumChanged) {
      this.frustum.setFrom(frust);
      this.render(exec);
    }

    return this._texture;
  }

  private static _drawParams?: DrawParams;

  public render(exec: ShaderProgramExecutor) {
    if (this._fbo === undefined)
      return;

    const state = new RenderState();
    state.flags.depthMask = false;
    state.flags.blend = false;
    state.flags.depthTest = false;

    // Render clip geometry as a mask
    System.instance.frameBufferStack.execute(this._fbo, true, () => {
      const prevState = System.instance.currentRenderState.clone();
      const target = exec.target;
      System.instance.applyRenderState(state);

      const context = System.instance.context;
      context.clearColor(0, 0, 0, 0);
      context.clear(context.COLOR_BUFFER_BIT);

      if (undefined === ClipMaskVolume._drawParams)
        ClipMaskVolume._drawParams = new DrawParams();

      const params = ClipMaskVolume._drawParams!;
      params.init(exec.params, this.geometry, target.currentTransform);
      exec.drawInterrupt(params);

      // Restore previous render state
      System.instance.applyRenderState(prevState);
    });
  }
}
