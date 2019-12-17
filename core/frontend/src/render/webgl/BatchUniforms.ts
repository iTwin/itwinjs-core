/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { desync, sync } from "./Sync";
import { UniformHandle } from "./Handle";
import { Target } from "./Target";
import { BatchState } from "./BranchState";
import { FeatureOverrides } from "./FeatureOverrides";
import { FeatureMode } from "./TechniqueFlags";
import { Batch } from "./Graphic";

/** Maintains uniform variable state associated with the Batch currently being drawn by a Target.
 * @internal
 */
export class BatchUniforms {
  public readonly state: BatchState;
  private readonly _target: Target;
  private _featureMode = FeatureMode.None;
  public syncKey = 0;

  private _overrides?: FeatureOverrides;
  private _batchId = new Float32Array(4);

  private _scratchBytes = new Uint8Array(4);
  private _scratchUint32 = new Uint32Array(this._scratchBytes.buffer);

  public constructor(target: Target, batchState: BatchState) {
    this.state = batchState;
    this._target = target;
  }

  public setCurrentBatch(batch: Batch | undefined): void {
    desync(this);

    if (undefined !== batch)
      this.state.push(batch, false);
    else
      this.state.pop();

    const batchId = this.state.currentBatchId;
    this._scratchUint32[0] = batchId;
    this._batchId[0] = this._scratchBytes[0];
    this._batchId[1] = this._scratchBytes[1];
    this._batchId[2] = this._scratchBytes[2];
    this._batchId[3] = this._scratchBytes[3];

    const overrides = undefined !== batch ? batch.getOverrides(this._target) : undefined;
    this._overrides = (undefined !== overrides && overrides.anyOverridden) ? overrides : undefined;

    if (undefined !== this._overrides)
      this._featureMode = FeatureMode.Overrides;
    else if (0 !== batchId)
      this._featureMode = FeatureMode.Pick;
    else
      this._featureMode = FeatureMode.None;
  }

  public resetBatchState(): void {
    this.state.reset();
  }

  public get featureMode(): FeatureMode { return this._featureMode; }

  public bindLUT(uniform: UniformHandle): void {
    // Note we can't use sync() here because a different texture may have been assigned to the desired texture unit
    if (undefined !== this._overrides)
      this._overrides.bindLUT(uniform);
  }

  public bindLUTParams(uniform: UniformHandle): void {
    if (undefined !== this._overrides && !sync(this, uniform))
      this._overrides.bindLUTParams(uniform);
  }

  public bindUniformSymbologyFlags(uniform: UniformHandle): void {
    if (sync(this, uniform))
      return;

    if (undefined !== this._overrides)
      this._overrides.bindUniformSymbologyFlags(uniform);
    else
      uniform.setUniform1f(0);
  }

  public bindBatchId(uniform: UniformHandle): void {
    if (!sync(this, uniform))
      uniform.setUniform4fv(this._batchId);
  }
}
