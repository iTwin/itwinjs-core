/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { assert, dispose, IDisposable } from "@bentley/bentleyjs-core";
import { Point3d, Transform } from "@bentley/geometry-core";
import { InstancedGraphicParams, RenderMemory } from "../System";
import { CachedGeometry, LUTGeometry } from "./CachedGeometry";
import { Target } from "./Target";
import { ShaderProgramParams } from "./DrawCommand";
import { AttributeHandle, BufferHandle } from "./Handle";
import { FeaturesInfo } from "./FeaturesInfo";

export class InstanceBuffers implements IDisposable {
  public readonly numInstances: number;
  public readonly transforms: BufferHandle;
  public readonly featureIds?: BufferHandle;
  public readonly featuresInfo?: FeaturesInfo;
  public readonly symbology?: BufferHandle;
  public readonly shared: boolean;
  // The center of the range of the instances' translations.
  private readonly _rtcCenter: Point3d;
  // A transform from _rtcCenter including model matrix
  private readonly _rtcTransform: Transform;
  // The model matrix from which _rtcTransform was previously computed. If it changes, _rtcTransform must be recomputed.
  private readonly _modelMatrix = Transform.createIdentity();

  private constructor(shared: boolean, count: number, transforms: BufferHandle, rtcCenter: Point3d, symbology?: BufferHandle, featureIds?: BufferHandle, featuresInfo?: FeaturesInfo) {
    this.shared = shared;
    this.numInstances = count;
    this.transforms = transforms;
    this.featureIds = featureIds;
    this.featuresInfo = featuresInfo;
    this.symbology = symbology;
    this._rtcCenter = rtcCenter;
    this._rtcTransform = Transform.createTranslation(this._rtcCenter);
  }

  public static create(params: InstancedGraphicParams, shared: boolean): InstanceBuffers | undefined {
    const { count, featureIds, symbologyOverrides, transforms } = params;

    assert(count > 0 && Math.floor(count) === count);
    assert(count === transforms.length / 12);
    assert(undefined === featureIds || count === featureIds.length / 3);
    assert(undefined === symbologyOverrides || count * 8 === symbologyOverrides.length);

    let idBuf: BufferHandle | undefined;
    if (undefined !== featureIds && undefined === (idBuf = BufferHandle.createArrayBuffer(featureIds)))
      return undefined;

    const featuresInfo = FeaturesInfo.createFromFeatureIds(featureIds);

    let symBuf: BufferHandle | undefined;
    if (undefined !== symbologyOverrides && undefined === (symBuf = BufferHandle.createArrayBuffer(symbologyOverrides)))
      return undefined;

    const tfBuf = BufferHandle.createArrayBuffer(transforms);
    return undefined !== tfBuf ? new InstanceBuffers(shared, count, tfBuf, params.transformCenter, symBuf, idBuf, featuresInfo) : undefined;
  }

  public getRtcTransform(modelMatrix: Transform): Transform {
    if (!this._modelMatrix.isAlmostEqual(modelMatrix)) {
      modelMatrix.clone(this._modelMatrix);
      const rtcTransform = Transform.createTranslation(this._rtcCenter);
      modelMatrix.multiplyTransformTransform(rtcTransform, this._rtcTransform);
    }

    return this._rtcTransform;
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
}

export class InstancedGeometry extends CachedGeometry {
  private readonly _buffers: InstanceBuffers;
  private readonly _repr: LUTGeometry;
  private readonly _ownsRepr: boolean;

  public get numInstances() { return this._buffers.numInstances; }
  public get transforms() { return this._buffers.transforms; }
  public get featureIds() { return this._buffers.featureIds; }
  public get symbology() { return this._buffers.symbology; }
  public getRtcTransform(modelMatrix: Transform) { return this._buffers.getRtcTransform(modelMatrix); }

  public get asInstanced() { return this; }
  public get asLUT() { return this._repr.asLUT; }
  public get asMesh() { return this._repr.asMesh; }
  public get asSurface() { return this._repr.asSurface; }
  public get asEdge() { return this._repr.asEdge; }
  public get asSilhouette() { return this._repr.asSilhouette; }

  public get renderOrder() { return this._repr.renderOrder; }
  public get isLitSurface() { return this._repr.isLitSurface; }
  public get hasBakedLighting() { return this._repr.hasBakedLighting; }
  public get hasAnimation() { return this._repr.hasAnimation; }
  public get qOrigin() { return this._repr.qOrigin; }
  public get qScale() { return this._repr.qScale; }
  public get material() { return this._repr.material; }
  public get polylineBuffers() { return this._repr.polylineBuffers; }
  public set uniformFeatureIndices(_value: number) { assert(false); } // This is used for decoration graphics. No such thing as instanced decorations.
  public get isEdge() { return this._repr.isEdge; }
  public get featuresInfo() { return this._buffers.featuresInfo; }

  public getTechniqueId(target: Target) { return this._repr.getTechniqueId(target); }
  public getRenderPass(target: Target) { return this._repr.getRenderPass(target); }
  public wantWoWReversal(params: ShaderProgramParams) { return this._repr.wantWoWReversal(params); }
  public getLineCode(params: ShaderProgramParams) { return this._repr.getLineCode(params); }
  public getLineWeight(params: ShaderProgramParams) { return this._repr.getLineWeight(params); }

  public constructor(repr: LUTGeometry, ownsRepr: boolean, buffers: InstanceBuffers) {
    super();
    this._repr = repr;
    this._ownsRepr = ownsRepr;
    this._buffers = buffers;
  }

  public dispose() {
    dispose(this._buffers);
    if (this._ownsRepr)
      this._repr.dispose();
  }

  public bindVertexArray(handle: AttributeHandle) {
    this._repr.bindVertexArray(handle);
  }

  protected _wantWoWReversal(_target: Target) {
    assert(false, "Should never be called");
    return false;
  }

  public draw() {
    this._repr.drawInstanced(this.numInstances);
  }

  public collectStatistics(stats: RenderMemory.Statistics) {
    this._repr.collectStatistics(stats);
    if (!this._buffers.shared)
      this._buffers.collectStatistics(stats);
  }
}
