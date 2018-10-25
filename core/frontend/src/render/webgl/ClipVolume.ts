/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { assert, dispose } from "@bentley/bentleyjs-core";
import { ClipVector, Point3d, ClipUtilities, Triangulator, PolyfaceBuilder, IndexedPolyfaceVisitor, UnionOfConvexClipPlaneSets, Vector3d, StrokeOptions } from "@bentley/geometry-core";
import { QPoint3dList, Frustum, QParams3d } from "@bentley/imodeljs-common";
import { ShaderProgramExecutor } from "./ShaderProgram";
import { Target } from "./Target";
import { RenderClipVolume, ClippingType } from "../System";
import { ClipMaskGeometry } from "./CachedGeometry";
import { ViewRect } from "../../Viewport";
import { FrameBuffer } from "./FrameBuffer";
import { TextureHandle, Texture2DHandle } from "./Texture";
import { GL } from "./GL";
import { System } from "./System";
import { RenderState } from "./RenderState";
import { DrawParams } from "./DrawCommand";

abstract class PlanesWriter {
  protected readonly _view: DataView;
  protected _curPos: number = 0;

  protected constructor(bytes: Uint8Array) { this._view = new DataView(bytes.buffer); }

  protected advance(numBytes: number): void { this._curPos += numBytes; }
  protected appendFloat(value: number): void { this._view.setFloat32(this._curPos, value, true); this.advance(4); }
  protected appendUint8(value: number): void { this._view.setUint8(this._curPos, value); this.advance(1); }

  protected abstract append(value: number): void;
  protected appendValues(a: number, b: number, c: number, d: number) {
    this.append(a);
    this.append(b);
    this.append(c);
    this.append(d);
  }

  public abstract get numPixelsPerPlane(): number;
  public abstract get dataType(): GL.Texture.DataType;

  public appendPlane(normal: Vector3d, distance: number): void { this.appendValues(normal.x, normal.y, normal.z, distance); }
  public appendZeroPlane(): void { this.appendValues(0, 0, 0, 0); }
}

// ###TODO float texture produces 'not renderable' errors? gotta be doing something wrong...
class FloatPlanesWriter extends PlanesWriter {
  public constructor(bytes: Uint8Array) { super(bytes); }

  public get numPixelsPerPlane() { return 1; }
  public get dataType() { return GL.Texture.DataType.Float; }

  public append(value: number) { this.appendFloat(value); }
}

class PackedPlanesWriter extends PlanesWriter {
  public constructor(bytes: Uint8Array) { super(bytes); }

  public get numPixelsPerPlane() { return 4; }
  public get dataType() { return GL.Texture.DataType.Float; }

  public append(value: number) {
    if (0 === value) {
      // typescript arrays are zero-initialized. The packed representation of 0.0 is 4 zero bytes.
      this.advance(4);
      return;
    }

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
}

/** A 3D clip volume defined as a texture derived from a set of planes. */
export class ClipPlanesVolume extends RenderClipVolume {
  private _texture?: TextureHandle;

  private constructor(texture?: TextureHandle) {
    super();
    this._texture = texture;
  }

  public get type(): ClippingType { return ClippingType.Planes; }
  public get texture(): TextureHandle | undefined { return this._texture; }

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

  private static createTexture(planeSet: UnionOfConvexClipPlaneSets, numPlanes: number, numConvexSets: number): TextureHandle | undefined {
    // Each row of texture holds one plane.
    // We will insert a sigil plane with a zero normal vector to indicate the beginning of another set of clip planes.
    const totalNumPlanes = numPlanes + (numConvexSets - 1);
    const bytes = new Uint8Array(totalNumPlanes * 4 * 4);

    let writer: PlanesWriter;
    const useFloatIfAvailable = false; // ###TODO if floating point textures supported...
    if (useFloatIfAvailable && System.instance.capabilities.supportsTextureFloat)
      writer = new FloatPlanesWriter(bytes);
    else
      writer = new PackedPlanesWriter(bytes);

    let numSetsProcessed = 0;
    for (const convexSet of planeSet.convexSets) {
      if (convexSet.planes.length === 0)
        continue;

      for (const plane of convexSet.planes)
        writer.appendPlane(plane.inwardNormalRef, plane.distance);

      numSetsProcessed++;
      if (numSetsProcessed < numConvexSets)
        writer.appendZeroPlane();
    }

    return Texture2DHandle.createForData(writer.numPixelsPerPlane, totalNumPlanes, bytes, false, GL.Texture.WrapMode.ClampToEdge, GL.Texture.Format.Rgba /*, writer.dataType*/);
  }

  public dispose() {
    this._texture = dispose(this._texture);
  }

  /** Push this ClipPlanesVolume clipping onto a target. */
  public pushToTarget(target: Target) {
    if (this._texture !== undefined)
      target.clips.set(this._texture.height, this._texture);
  }

  /** Push this ClipPlanesVolume clipping onto the target of a shader program executor. */
  public pushToShaderExecutor(shader: ShaderProgramExecutor) {
    this.pushToTarget(shader.target);
  }

  /** Pop this ClipPlanesVolume clipping from a target. */
  public pop(target: Target) {
    target.clips.clear();
  }
}

/** A 2D clip volume defined as a texture derived from a masked set of planes. */
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
        const triangulatedPolygonGraph = Triangulator.earcutSingleLoop(clippedPolygon);
        Triangulator.cleanupTriangulation(triangulatedPolygonGraph);
        polyfaceBuilder.addGraph(triangulatedPolygonGraph, false);
      }
    }
    const polyface = polyfaceBuilder.claimPolyface();
    const nPoints = polyface.pointCount;
    const pPoints = polyface.data.point;
    assert(nPoints !== 0);

    for (let i = 0; i < nPoints; i++)
      vertices.add(pPoints.getPoint3dAt(i));

    const visitor = IndexedPolyfaceVisitor.create(polyface, 0);
    while (visitor.moveToNextFacet())
      for (let i = 0; i < 3; i++)
        indices.push(visitor.clientPointIndex(i));

    assert(indices.length > 0);
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
