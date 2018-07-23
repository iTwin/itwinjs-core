/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { ClipVector, Point3d, ClipUtilities, Triangulator, PolyfaceBuilder, IndexedPolyfaceVisitor, UnionOfConvexClipPlaneSets, Vector3d } from "@bentley/geometry-core";
import { ShaderProgramExecutor } from "./ShaderProgram";
import { Target } from "./Target";
import { RenderClipVolume } from "../System";
import { QPoint3dList, Frustum, QParams3d } from "@bentley/imodeljs-common/lib/common";
import { ClipMaskGeometry } from "./CachedGeometry";
import { ViewRect } from "../../Viewport";
import { FrameBuffer } from "./FrameBuffer";
import { dispose } from "@bentley/bentleyjs-core/lib/Disposable";
import { assert } from "@bentley/bentleyjs-core/lib/Assert";
import { TextureHandle, Texture2DHandle } from "./Texture";
import { GL } from "./GL";
import { System } from "./System";
import { RenderState } from "./RenderState";
import { DrawParams } from "./DrawCommand";
import { RenderPass } from "./RenderFlags";

/** Internal class for creating a ClipPlanesVolume texture when the system does not support texture floats. */
class PackedTraits {
  public numPixelsPerPlane: number = 4;
  public internalFormat: GL.Texture.Format = GL.Texture.Format.Rgba;
  public dataType: GL.Texture.DataType = GL.Texture.DataType.UnsignedByte;

  /** Set float values in the given array to ClipPlane members variables. Returns the index of the next normal.x value to be set. */
  public appendPlane(pixels: Float32Array, index: number, normal: Vector3d, distance: number): number {
    pixels[index] = normal.x;
    pixels[index + 1] = normal.y;
    pixels[index + 2] = normal.z;
    pixels[index + 3] = distance;
    return index + 4;
  }
}

/** A 3D clip volume defined as a set of planes. */
export class ClipPlanesVolume extends RenderClipVolume {
  private _texture?: TextureHandle;

  private constructor(texture?: TextureHandle) {
    super();
    this._texture = texture;
  }

  /** Create a new ClipPlanesVolume from a ClipVector. */
  public static create(clipVec: ClipVector): ClipPlanesVolume | undefined {
    if (1 !== clipVec.clips.length)
      return undefined;

    const clipPrim = clipVec.clips[0];
    const clipPlaneSet = clipPrim.fetchClipPlanesRef();
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

    const texture = this.createTexture(clipPlaneSet, numPlanes, numSets);
    return new ClipPlanesVolume(texture);
  }

  /** Create a texture for a new ClipPlanesVolume. */
  private static createTexture(planeSet: UnionOfConvexClipPlaneSets, numPlanes: number, numConvexSets: number): TextureHandle | undefined {
    // ###TODO: Support creating textures with float values?..
    return this.createTextureUsingPackedTraits(planeSet, numPlanes, numConvexSets, new PackedTraits());
  }

  /** Create a texture for a new ClipPlanesVolume using unsigned byte values. */
  private static createTextureUsingPackedTraits(planeSet: UnionOfConvexClipPlaneSets, numPlanes: number, numConvexSets: number, traits: PackedTraits): TextureHandle | undefined {
    // We will insert a sigil plane with a zero normal vector to indicate the beginning of another set of clip planes.
    const totalNumPlanes = numPlanes + (numConvexSets - 1);

    // Texture height == number of clipping planes
    const numPixelsPerPlane = traits.numPixelsPerPlane;

    const bytes = new Float32Array(totalNumPlanes * 4);
    let currentIdx = 0;
    let numSetsProcessed = 0;
    for (const convexSet of planeSet.convexSets) {
      if (convexSet.planes.length === 0)
        continue;

      for (const plane of convexSet.planes)
        currentIdx = traits.appendPlane(bytes, currentIdx, plane.inwardNormalRef, plane.distance);

      numSetsProcessed++;
      if (numSetsProcessed < numConvexSets)
        currentIdx = traits.appendPlane(bytes, currentIdx, Vector3d.createZero(), 0);
    }

    const internalFormat = traits.internalFormat;
    return Texture2DHandle.createForData(numPixelsPerPlane, totalNumPlanes, Uint8Array.from(bytes), false, GL.Texture.WrapMode.ClampToEdge, internalFormat);
  }

  public dispose() {
    this._texture = dispose(this._texture);
  }

  public push(shader: ShaderProgramExecutor) {
    if (this._texture !== undefined)
      shader.target.clips.set(this._texture.height, this._texture);
  }

  public pop(target: Target) {
    target.clips.clear();
  }
}

/** A 2D clip volume defined as a mask. */
export class ClipMaskVolume implements RenderClipVolume {
  public readonly geometry: ClipMaskGeometry;
  public readonly frustum: Frustum;
  public readonly rect: ViewRect;
  private _texture?: TextureHandle;
  private _fbo?: FrameBuffer;

  private constructor(geometry: ClipMaskGeometry) {
    this.geometry = geometry;
    this.frustum = new Frustum();
    this.rect = new ViewRect(0, 0, 0, 0);
  }

  /** Create a new ClipMaskVolume from a clip vector. */
  public static create(clipVec: ClipVector): ClipMaskVolume | undefined {
    const range = clipVec.boundingRange;
    if (range.isNull())
      return undefined;

    const pts: Point3d[] = [
      Point3d.create(range.low.x, range.low.y, 0),
      Point3d.create(range.high.x, range.low.y, 0),
      Point3d.create(range.high.x, range.high.y, 0),
      Point3d.create(range.low.x, range.high.y, 0),
    ];

    const clippedPolygonInsides = ClipUtilities.clipPolygonToClipVector(pts, clipVec);
    const indices: number[] = [];
    const vertices = QPoint3dList.createFrom([], QParams3d.fromRange(range));
    let indexOffset = 0;

    for (const clippedPolygon of clippedPolygonInsides) {
      const triangulatedPolygonGraph = Triangulator.earcutFromPoints(clippedPolygon);
      Triangulator.cleanupTriangulation(triangulatedPolygonGraph);
      const polyfaceBuilder = PolyfaceBuilder.create();
      polyfaceBuilder.addGraph(triangulatedPolygonGraph, false);
      const polyface = polyfaceBuilder.claimPolyface();

      const nPoints = polyface.pointCount;
      const pPoints = polyface.data.point;
      const pIndices = polyface.data.pointIndex;
      assert(nPoints !== 0);

      for (let i = 0; i < nPoints; i++)
        vertices.add(pPoints.getPoint3dAt(i));

      const visitor = IndexedPolyfaceVisitor.create(polyface, 0);
      while (visitor.moveToNextFacet())
        for (let i = 0; i < 3; i++)
          pIndices.push(indexOffset + visitor.clientPointIndex(i));

      assert(pIndices.length > 0);
      indexOffset += pIndices.length;
    }

    if (indices.length === 0 || vertices.length === 0)
      return undefined;

    return new ClipMaskVolume(new ClipMaskGeometry(new Uint32Array(indices), vertices));
  }

  public get texture(): TextureHandle | undefined { return this._texture; }
  public get fbo(): FrameBuffer | undefined { return this._fbo; }

  public dispose() {
    this._texture = dispose(this._texture);
    this._fbo = dispose(this._fbo);
  }

  /** Push this clip mask texture onto the target of a program executor. */
  public push(shader: ShaderProgramExecutor) {
    if (this._texture !== undefined)
      shader.target.clipMask = this._texture;
  }

  /** Clear a target's clip mask, provided that this ClipMaskVolume's texture is not undefined. */
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

  public render(exec: ShaderProgramExecutor) {
    if (this._fbo === undefined)
      return;

    const state = new RenderState();
    state.flags.depthMask = false;
    state.flags.blend = false;
    state.flags.depthTest = false;

    // Render clip geometry as a mask
    System.instance.frameBufferStack.execute(this._fbo, true, () => {
      const prevState = System.instance.currentRenderState;
      const target = exec.target;
      System.instance.applyRenderState(state);

      const context = System.instance.context;
      context.clearColor(0, 0, 0, 0);
      context.clear(context.COLOR_BUFFER_BIT);

      const params = new DrawParams(target, this.geometry, target.currentTransform, RenderPass.OpaqueGeneral);
      exec.drawInterrupt(params);

      // Restore previous render state
      System.instance.applyRenderState(prevState);
    });
  }
}
