/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert, dispose } from "@itwin/core-bentley";
import { Point3d, Range3d, Transform } from "@itwin/core-geometry";
import { InstancedGraphicParams, PatternGraphicParams } from "../InstancedGraphicParams";
import { RenderMemory } from "../RenderMemory";
import { AttributeMap } from "./AttributeMap";
import { CachedGeometry, LUTGeometry } from "./CachedGeometry";
import { ShaderProgramParams } from "./DrawCommand";
import { GL } from "./GL";
import { BufferHandle, BufferParameters, BuffersContainer } from "./AttributeBuffers";
import { Target } from "./Target";
import { TechniqueId } from "./TechniqueId";
import { Matrix4 } from "./Matrix";

/** @internal */
export function isInstancedGraphicParams(params: any): params is InstancedGraphicParams {
  return typeof params === "object" && typeof params.count === "number" && params.transforms instanceof Float32Array && params.transformCenter instanceof Point3d;
}

class InstanceData {
  public readonly numInstances: number;
  public readonly range: Range3d;
  // A transform including only rtcCenter.
  private readonly _rtcOnlyTransform: Transform;
  // A transform from _rtcCenter including model matrix
  private readonly _rtcModelTransform: Transform;
  // The model matrix from which _rtcModelTransform was previously computed. If it changes, _rtcModelTransform must be recomputed.
  private readonly _modelMatrix = Transform.createIdentity();

  protected constructor(numInstances: number, rtcCenter: Point3d, range: Range3d) {
    this.numInstances = numInstances;
    this.range = range;
    this._rtcOnlyTransform = Transform.createTranslation(rtcCenter);
    this._rtcModelTransform = this._rtcOnlyTransform.clone();
  }

  public getRtcModelTransform(modelMatrix: Transform): Transform {
    if (!this._modelMatrix.isAlmostEqual(modelMatrix)) {
      modelMatrix.clone(this._modelMatrix);
      modelMatrix.multiplyTransformTransform(this._rtcOnlyTransform, this._rtcModelTransform);
    }

    return this._rtcModelTransform;
  }

  public getRtcOnlyTransform(): Transform {
    return this._rtcOnlyTransform;
  }

  private static readonly _noFeatureId = new Float32Array([0, 0, 0]);
  public get patternFeatureId(): Float32Array {
    return InstanceData._noFeatureId;
  }
}

/** @internal */
export interface PatternTransforms {
  readonly orgTransform: Matrix4;
  readonly localToModel: Matrix4;
  readonly symbolToLocal: Matrix4;
  readonly origin: Float32Array;
}

/** @internal */
export class InstanceBuffers extends InstanceData {
  private static readonly _patternParams = new Float32Array([0, 0, 0, 0]);

  public readonly transforms: BufferHandle;
  public readonly featureIds?: BufferHandle;
  public readonly hasFeatures: boolean;
  public readonly symbology?: BufferHandle;
  public readonly patternParams = InstanceBuffers._patternParams;
  public readonly patternTransforms = undefined;
  public readonly viewIndependentOrigin = undefined;

  private constructor(count: number, transforms: BufferHandle, rtcCenter: Point3d, range: Range3d, symbology?: BufferHandle, featureIds?: BufferHandle) {
    super(count, rtcCenter, range);
    this.transforms = transforms;
    this.featureIds = featureIds;
    this.hasFeatures = undefined !== featureIds;
    this.symbology = symbology;
  }

  public static createTransformBufferParameters(techniqueId: TechniqueId): BufferParameters[] {
    const params: BufferParameters[] = [];
    const numRows = 3;
    let row = 0;
    while (row < numRows) {
      // 3 rows per instance; 4 floats per row; 4 bytes per float.
      const floatsPerRow = 4;
      const bytesPerVertex = floatsPerRow * 4;
      const offset = row * bytesPerVertex;
      const stride = 3 * bytesPerVertex;
      const name = `a_instanceMatrixRow${row}`;
      const details = AttributeMap.findAttribute(name, techniqueId, true);
      assert(details !== undefined);
      const bParams: BufferParameters = {
        glAttribLoc: details.location,
        glSize: floatsPerRow,
        glType: GL.DataType.Float,
        glNormalized: false,
        glStride: stride,
        glOffset: offset,
        glInstanced: true,
      };
      params.push(bParams);
      row++;
    }
    return params;
  }

  public static create(params: InstancedGraphicParams, range: Range3d): InstanceBuffers | undefined {
    const { count, featureIds, symbologyOverrides, transforms } = params;

    assert(count > 0 && Math.floor(count) === count);
    assert(count === transforms.length / 12);
    assert(undefined === featureIds || count === featureIds.length / 3);
    assert(undefined === symbologyOverrides || count * 8 === symbologyOverrides.length);

    let idBuf: BufferHandle | undefined;
    if (undefined !== featureIds && undefined === (idBuf = BufferHandle.createArrayBuffer(featureIds)))
      return undefined;

    let symBuf: BufferHandle | undefined;
    if (undefined !== symbologyOverrides && undefined === (symBuf = BufferHandle.createArrayBuffer(symbologyOverrides)))
      return undefined;

    const tfBuf = BufferHandle.createArrayBuffer(transforms);
    return undefined !== tfBuf ? new InstanceBuffers(count, tfBuf, params.transformCenter, range, symBuf, idBuf) : undefined;
  }

  public get isDisposed(): boolean {
    return this.transforms.isDisposed
      && (undefined === this.featureIds || this.featureIds.isDisposed)
      && (undefined === this.symbology || this.symbology.isDisposed);
  }

  public dispose() {
    dispose(this.transforms);
    dispose(this.featureIds);
    dispose(this.symbology);
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    const featureBytes = undefined !== this.featureIds ? this.featureIds.bytesUsed : 0;
    const symBytes = undefined !== this.symbology ? this.symbology.bytesUsed : 0;

    const bytesUsed = this.transforms.bytesUsed + symBytes + featureBytes;
    stats.addInstances(bytesUsed);
  }

  private static extendTransformedRange(tfs: Float32Array, i: number, range: Range3d, x: number, y: number, z: number) {
    range.extendXYZ(tfs[i + 3] + tfs[i + 0] * x + tfs[i + 1] * y + tfs[i + 2] * z,
      tfs[i + 7] + tfs[i + 4] * x + tfs[i + 5] * y + tfs[i + 6] * z,
      tfs[i + 11] + tfs[i + 8] * x + tfs[i + 9] * y + tfs[i + 10] * z);
  }

  public static computeRange(reprRange: Range3d, tfs: Float32Array, rtcCenter: Point3d, out?: Range3d): Range3d {
    const range = out ?? new Range3d();

    const numFloatsPerTransform = 3 * 4;
    assert(0 === tfs.length % (3 * 4));

    for (let i = 0; i < tfs.length; i += numFloatsPerTransform) {
      this.extendTransformedRange(tfs, i, range, reprRange.low.x, reprRange.low.y, reprRange.low.z);
      this.extendTransformedRange(tfs, i, range, reprRange.low.x, reprRange.low.y, reprRange.high.z);
      this.extendTransformedRange(tfs, i, range, reprRange.low.x, reprRange.high.y, reprRange.low.z);
      this.extendTransformedRange(tfs, i, range, reprRange.low.x, reprRange.high.y, reprRange.high.z);
      this.extendTransformedRange(tfs, i, range, reprRange.high.x, reprRange.low.y, reprRange.low.z);
      this.extendTransformedRange(tfs, i, range, reprRange.high.x, reprRange.low.y, reprRange.high.z);
      this.extendTransformedRange(tfs, i, range, reprRange.high.x, reprRange.high.y, reprRange.low.z);
      this.extendTransformedRange(tfs, i, range, reprRange.high.x, reprRange.high.y, reprRange.high.z);
    }

    range.low.addInPlace(rtcCenter);
    range.high.addInPlace(rtcCenter);

    return range.clone(out);
  }
}

/** @internal */
export class PatternBuffers extends InstanceData {
  private readonly _featureId?: Float32Array;

  private constructor(
    count: number,
    rtcCenter: Point3d,
    range: Range3d,
    public readonly patternParams: Float32Array, // [ isAreaPattern, spacingX, spacingY, scale ]
    public readonly origin: Float32Array, // [ x, y ]
    public readonly orgTransform: Matrix4,
    public readonly localToModel: Matrix4,
    public readonly symbolToLocal: Matrix4,
    public readonly offsets: BufferHandle,
    featureId: number | undefined,
    public readonly viewIndependentOrigin: Point3d | undefined
  ) {
    super(count, rtcCenter, range);
    this.patternTransforms = this;
    if (undefined !== featureId) {
      this._featureId = new Float32Array([
        (featureId & 0x0000ff) >>> 0,
        (featureId & 0x00ff00) >>> 8,
        (featureId & 0xff0000) >>> 16,
      ]);
    }
  }

  public static create(params: PatternGraphicParams): PatternBuffers | undefined {
    const count = params.xyOffsets.byteLength / 2;
    assert(Math.floor(count) === count);

    const offsets = BufferHandle.createArrayBuffer(params.xyOffsets);
    if (!offsets)
      return undefined;

    return new PatternBuffers(
      count,
      new Point3d(),
      params.range,
      new Float32Array([1, params.spacing.x, params.spacing.y, params.scale]),
      new Float32Array([params.origin.x, params.origin.y]),
      Matrix4.fromTransform(params.orgTransform),
      Matrix4.fromTransform(params.patternToModel),
      Matrix4.fromTransform(Transform.createTranslation(params.symbolTranslation)),
      offsets,
      params.featureId,
      params.viewIndependentOrigin,
    );
  }

  public readonly patternTransforms: PatternTransforms;

  public get hasFeatures(): boolean {
    return undefined !== this._featureId;
  }

  public override get patternFeatureId(): Float32Array {
    return this._featureId ?? super.patternFeatureId;
  }

  public get isDisposed(): boolean {
    return this.offsets.isDisposed;
  }

  public dispose(): void {
    dispose(this.offsets);
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    stats.addInstances(this.offsets.bytesUsed);
  }
}

/** @internal */
export class InstancedGeometry extends CachedGeometry {
  private readonly _buffersContainer: BuffersContainer;
  private readonly _buffers: InstanceBuffers | PatternBuffers;
  private readonly _repr: LUTGeometry;
  private readonly _ownsBuffers: boolean;

  public getRtcModelTransform(modelMatrix: Transform) { return this._buffers.getRtcModelTransform(modelMatrix); }
  public getRtcOnlyTransform() { return this._buffers.getRtcOnlyTransform(); }

  public override get viewIndependentOrigin(): Point3d | undefined { return this._buffers.viewIndependentOrigin; }

  public override get asInstanced() { return this; }
  public override get asLUT() { return this._repr.asLUT; }
  public override get asMesh() { return this._repr.asMesh; }
  public override get asSurface() { return this._repr.asSurface; }
  public override get asEdge() { return this._repr.asEdge; }
  public override get asSilhouette() { return this._repr.asSilhouette; }

  public get renderOrder() { return this._repr.renderOrder; }
  public override get isLitSurface() { return this._repr.isLitSurface; }
  public override get hasBakedLighting() { return this._repr.hasBakedLighting; }
  public override get hasAnimation() { return this._repr.hasAnimation; }
  public get qOrigin() { return this._repr.qOrigin; }
  public get qScale() { return this._repr.qScale; }
  public override get materialInfo() { return this._repr.materialInfo; }
  public override get polylineBuffers() { return this._repr.polylineBuffers; }
  public override get isEdge() { return this._repr.isEdge; }
  public override get hasFeatures() { return this._buffers.hasFeatures; }
  public get techniqueId(): TechniqueId { return this._repr.techniqueId; }
  public override get supportsThematicDisplay() { return this._repr.supportsThematicDisplay; }

  public getRenderPass(target: Target) { return this._repr.getRenderPass(target); }
  public override wantWoWReversal(params: ShaderProgramParams) { return this._repr.wantWoWReversal(params); }
  public override getLineCode(params: ShaderProgramParams) { return this._repr.getLineCode(params); }
  public override getLineWeight(params: ShaderProgramParams) { return this._repr.getLineWeight(params); }
  public override wantMonochrome(target: Target) { return this._repr.wantMonochrome(target); }

  public static create(repr: LUTGeometry, ownsBuffers: boolean, buffers: InstanceBuffers): InstancedGeometry {
    const techId = repr.techniqueId;
    const container = BuffersContainer.create();
    container.appendLinkages(repr.lutBuffers.linkages);

    container.addBuffer(buffers.transforms, InstanceBuffers.createTransformBufferParameters(repr.techniqueId));

    if (buffers.symbology) {
      const attrInstanceOverrides = AttributeMap.findAttribute("a_instanceOverrides", techId, true);
      const attrInstanceRgba = AttributeMap.findAttribute("a_instanceRgba", techId, true);
      assert(attrInstanceOverrides !== undefined);
      assert(attrInstanceRgba !== undefined);
      container.addBuffer(buffers.symbology, [
        BufferParameters.create(attrInstanceOverrides.location, 4, GL.DataType.UnsignedByte, false, 8, 0, true),
        BufferParameters.create(attrInstanceRgba.location, 4, GL.DataType.UnsignedByte, false, 8, 4, true),
      ]);
    }
    if (buffers.featureIds) {
      const attrFeatureId = AttributeMap.findAttribute("a_featureId", techId, true);
      assert(attrFeatureId !== undefined);
      container.addBuffer(buffers.featureIds, [BufferParameters.create(attrFeatureId.location, 3, GL.DataType.UnsignedByte, false, 0, 0, true)]);
    }

    return new this(repr, ownsBuffers, buffers, container);
  }

  public static createPattern(repr: LUTGeometry, ownsBuffers: boolean, buffers: PatternBuffers): InstancedGeometry {
    const techId = repr.techniqueId;
    const container = BuffersContainer.create();
    container.appendLinkages(repr.lutBuffers.linkages);

    const attrX = AttributeMap.findAttribute("a_patternX", techId, true);
    const attrY = AttributeMap.findAttribute("a_patternY", techId, true);
    assert(undefined !== attrX && undefined !== attrY);
    container.addBuffer(buffers.offsets, [
      BufferParameters.create(attrX.location, 1, GL.DataType.Float, false, 8, 0, true),
      BufferParameters.create(attrY.location, 1, GL.DataType.Float, false, 8, 4, true),
    ]);

    return new this(repr, ownsBuffers, buffers, container);
  }

  private constructor(repr: LUTGeometry, ownsBuffers: boolean, buffers: InstanceBuffers | PatternBuffers, container: BuffersContainer) {
    super();
    this._repr = repr;
    this._ownsBuffers = ownsBuffers;
    this._buffers = buffers;
    this._buffersContainer = container;
  }

  public get isDisposed(): boolean {
    if (!this._repr.isDisposed)
      return false;

    return !this._ownsBuffers || this._buffers.isDisposed;
  }

  public dispose() {
    this._repr.dispose();
    if (this._ownsBuffers)
      dispose(this._buffers);
  }

  protected _wantWoWReversal(_target: Target) {
    assert(false, "Should never be called");
    return false;
  }

  public draw() {
    this._repr.drawInstanced(this._buffers.numInstances, this._buffersContainer);
  }

  public override computeRange(output?: Range3d): Range3d {
    return this._buffers.range.clone(output);
  }

  public collectStatistics(stats: RenderMemory.Statistics) {
    this._repr.collectStatistics(stats);
    if (this._ownsBuffers)
      this._buffers.collectStatistics(stats);
  }

  public get patternParams(): Float32Array { return this._buffers.patternParams; }
  public get patternTransforms(): PatternTransforms | undefined { return this._buffers.patternTransforms; }
  public get patternFeatureId(): Float32Array { return this._buffers.patternFeatureId; }
}
