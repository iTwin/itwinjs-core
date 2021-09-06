/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert, dispose } from "@bentley/bentleyjs-core";
import { Point3d, Range3d, Transform } from "@bentley/geometry-core";
import { InstancedGraphicParams } from "../InstancedGraphicParams";
import { RenderMemory } from "../RenderMemory";
import { AttributeMap } from "./AttributeMap";
import { CachedGeometry, LUTGeometry } from "./CachedGeometry";
import { WebGLDisposable } from "./Disposable";
import { ShaderProgramParams } from "./DrawCommand";
import { GL } from "./GL";
import { BufferHandle, BufferParameters, BuffersContainer } from "./AttributeBuffers";
import { Target } from "./Target";
import { TechniqueId } from "./TechniqueId";

class InstanceData {
  public readonly shared: boolean;
  public readonly numInstances: number;
  public readonly range: Range3d;
  // A transform including only rtcCenter.
  private readonly _rtcOnlyTransform: Transform;
  // A transform from _rtcCenter including model matrix
  private readonly _rtcModelTransform: Transform;
  // The model matrix from which _rtcModelTransform was previously computed. If it changes, _rtcModelTransform must be recomputed.
  private readonly _modelMatrix = Transform.createIdentity();

  protected constructor(numInstances: number, shared: boolean, rtcCenter: Point3d, range: Range3d) {
    this.numInstances = numInstances;
    this.shared = shared;
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
}

/** @internal */
export class InstanceBuffers extends InstanceData {
  public readonly transforms: BufferHandle;
  public readonly featureIds?: BufferHandle;
  public readonly hasFeatures: boolean;
  public readonly symbology?: BufferHandle;

  private constructor(shared: boolean, count: number, transforms: BufferHandle, rtcCenter: Point3d, range: Range3d, symbology?: BufferHandle, featureIds?: BufferHandle) {
    super(count, shared, rtcCenter, range);
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

  public static create(params: InstancedGraphicParams, shared: boolean, range: Range3d): InstanceBuffers | undefined {
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
    return undefined !== tfBuf ? new InstanceBuffers(shared, count, tfBuf, params.transformCenter, range, symBuf, idBuf) : undefined;
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

  public static computeRange(reprRange: Range3d, tfs: Float32Array, rtcCenter: Point3d, out?: Range3d): Range3d {
    const range = out ?? new Range3d();

    const numFloatsPerTransform = 3 * 4;
    assert(0 === tfs.length % (3 * 4));

    const tf = Transform.createIdentity();
    const r = new Range3d();
    for (let i = 0; i < tfs.length; i += numFloatsPerTransform) {
      tf.setFromJSON({
        origin: [tfs[i + 3], tfs[i + 7], tfs[i + 11]],
        matrix: [
          [tfs[i + 0], tfs[i + 1], tfs[i + 2]],
          [tfs[i + 4], tfs[i + 5], tfs[i + 6]],
          [tfs[i + 8], tfs[i + 9], tfs[i + 10]],
        ],
      });

      reprRange.clone(r);
      tf.multiplyRange(r, r);
      range.extendRange(r);
    }

    const rtcTransform = Transform.createTranslation(rtcCenter);
    rtcTransform.multiplyRange(range, range);

    return range.clone(out);
  }
}

/** @internal */
export class PatternBuffers extends InstanceData {
  public readonly featureId?: number;
  private readonly _transforms: BufferHandle;

  private constructor(shared: boolean, count: number, transforms: BufferHandle, rtcCenter: Point3d, range: Range3d, featureId: number | undefined) {
    super(count, shared, rtcCenter, range);
    this._transforms = transforms;
    this.featureId = featureId;
    // ###TODO additional members...
  }

  // ###TODO public static create(...)

  public get hasFeatures(): boolean {
    return undefined !== this.featureId;
  }

  public get isDisposed(): boolean {
    return this._transforms.isDisposed;
  }

  public dispose(): void {
    dispose(this._transforms);
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    stats.addInstances(this._transforms.bytesUsed);
  }
}

/** @internal */
export class InstancedGeometry extends CachedGeometry {
  private readonly _buffersContainer: BuffersContainer;
  private readonly _buffers: InstanceBuffers;
  private readonly _repr: LUTGeometry;
  private readonly _ownsRepr: boolean;

  public getRtcModelTransform(modelMatrix: Transform) { return this._buffers.getRtcModelTransform(modelMatrix); }
  public getRtcOnlyTransform() { return this._buffers.getRtcOnlyTransform(); }

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

  public constructor(repr: LUTGeometry, ownsRepr: boolean, buffers: InstanceBuffers) {
    super();
    this._repr = repr;
    this._ownsRepr = ownsRepr;
    this._buffers = buffers;
    this._buffersContainer = BuffersContainer.create();
    this._buffersContainer.appendLinkages(repr.lutBuffers.linkages);

    this._buffersContainer.addBuffer(this._buffers.transforms, InstanceBuffers.createTransformBufferParameters(this.techniqueId));
    if (this._buffers.symbology !== undefined) {
      const attrInstanceOverrides = AttributeMap.findAttribute("a_instanceOverrides", this.techniqueId, true);
      const attrInstanceRgba = AttributeMap.findAttribute("a_instanceRgba", this.techniqueId, true);
      assert(attrInstanceOverrides !== undefined);
      assert(attrInstanceRgba !== undefined);
      this._buffersContainer.addBuffer(this._buffers.symbology, [
        BufferParameters.create(attrInstanceOverrides.location, 4, GL.DataType.UnsignedByte, false, 8, 0, true),
        BufferParameters.create(attrInstanceRgba.location, 4, GL.DataType.UnsignedByte, false, 8, 4, true),
      ]);
    }
    if (this._buffers.featureIds !== undefined) {
      const attrFeatureId = AttributeMap.findAttribute("a_featureId", this.techniqueId, true);
      assert(attrFeatureId !== undefined);
      this._buffersContainer.addBuffer(this._buffers.featureIds, [BufferParameters.create(attrFeatureId.location, 3, GL.DataType.UnsignedByte, false, 0, 0, true)]);
    }
  }

  public get isDisposed(): boolean {
    let isReprDisposed = true;
    if (this._ownsRepr)
      isReprDisposed = this._repr.isDisposed;
    return this._buffers.isDisposed && isReprDisposed;
  }

  public dispose() {
    dispose(this._buffers);
    if (this._ownsRepr)
      this._repr.dispose();
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
    if (!this._buffers.shared)
      this._buffers.collectStatistics(stats);
  }
}
