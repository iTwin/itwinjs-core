/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { assert, dispose } from "@bentley/bentleyjs-core";
import { RenderMemory } from "../System";
import { CachedGeometry, LUTGeometry } from "./CachedGeometry";
import { Target } from "./Target";
import { ShaderProgramParams } from "./DrawCommand";
import { AttributeHandle, BufferHandle } from "./Handle";

export interface InstancedGraphicParams {
  /** The number of instances.
   * Must be greater than zero.
   * Must be equal to (transforms.length / 12)
   * If featureIds is defined, must be equal to (featureIds.length / 3)
   */
  readonly count: number;
  /** An array of instance-to-model transforms. Each transform consists of 3 rows of 4 columns where the 4th column holds the translation. */
  readonly transforms: Float32Array;
  /** If defined, an array of little-endian 24-bit unsigned integers containing the feature ID of each instance. */
  readonly featureIds?: Uint8Array;
}

export class InstancedGeometry extends CachedGeometry {
  public readonly numInstances: number;
  public readonly transforms: BufferHandle;
  public readonly featureIds?: BufferHandle;
  private readonly _repr: LUTGeometry;
  private readonly _ownsRepr: boolean;

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
  public set uniformFeatureIndices(value: number) { this._repr.uniformFeatureIndices = value; }
  public get isEdge() { return this._repr.isEdge; }
  public get featuresInfo() { return this._repr.featuresInfo; }

  public getTechniqueId(target: Target) { return this._repr.getTechniqueId(target); }
  public getRenderPass(target: Target) { return this._repr.getRenderPass(target); }
  public wantWoWReversal(params: ShaderProgramParams) { return this._repr.wantWoWReversal(params); }
  public getLineCode(params: ShaderProgramParams) { return this._repr.getLineCode(params); }
  public getLineWeight(params: ShaderProgramParams) { return this._repr.getLineWeight(params); }

  public static create(repr: LUTGeometry, ownsRepr: boolean, params: InstancedGraphicParams): InstancedGeometry | undefined {
    const { count, transforms, featureIds } = params;
    assert(count > 0 && Math.floor(count) === count);
    assert(count === transforms.length / 12);
    assert(undefined === featureIds || count === featureIds.length / 3);

    let idBuf: BufferHandle | undefined;
    if (undefined !== featureIds && undefined === (idBuf = BufferHandle.createArrayBuffer(featureIds)))
      return undefined;

    const tfBuf = BufferHandle.createArrayBuffer(transforms);
    return undefined !== tfBuf ? new InstancedGeometry(repr, ownsRepr, count, tfBuf, idBuf) : undefined;
  }

  private static readonly _fakeTransforms = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]);
  private static readonly _fakeIds = new Uint8Array([0, 0, 0]);
  public static createFake(repr: LUTGeometry): InstancedGeometry | undefined {
    return this.create(repr, true, { count: 1, transforms: this._fakeTransforms, featureIds: this._fakeIds });
  }

  private constructor(repr: LUTGeometry, ownsRepr: boolean, count: number, transforms: BufferHandle, featureIds?: BufferHandle) {
    super();
    this._repr = repr;
    this._ownsRepr = ownsRepr;
    this.numInstances = count;
    this.transforms = transforms;
    this.featureIds = featureIds;
  }

  public dispose() {
    dispose(this.transforms);
    dispose(this.featureIds);
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
    // ###TODO_INSTANCING: Record memory allocated to attributes
    this._repr.collectStatistics(stats);
  }
}
