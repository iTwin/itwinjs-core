/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { BatchState } from "./BatchState";
import { FeatureOverrides } from "./FeatureOverrides";
import { Batch } from "./Graphic";
import { UniformHandle } from "./UniformHandle";
import { desync, sync } from "./Sync";
import { Target } from "./Target";
import { FeatureMode } from "./TechniqueFlags";
import { ThematicSensors } from "./ThematicSensors";
import { OvrFlags } from "./RenderFlags";

const scratchRgb = new Float32Array(3);
const noOverrideRgb = new Float32Array([-1.0, -1.0, -1.0]);

/** Maintains uniform variable state associated with the Batch currently being drawn by a Target.
 * @internal
 */
export class BatchUniforms {
  public readonly state: BatchState;
  private readonly _target: Target;
  private _featureMode = FeatureMode.None;
  public syncKey = 0;

  private _overrides?: FeatureOverrides;
  private _sensors?: ThematicSensors;
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

    let sensors: ThematicSensors | undefined;
    if (undefined !== batch && this._target.wantThematicSensors) {
      const distanceCutoff = this._target.plan.thematic!.sensorSettings.distanceCutoff;
      if (distanceCutoff > 0) // if we have a distance cutoff, we want to create per-batch sensor textures
        sensors = batch.getThematicSensors(this._target);
    }
    this._sensors = sensors;

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

  public bindNumThematicSensors(uniform: UniformHandle): void {
    if (undefined !== this._sensors)
      this._sensors.bindNumSensors(uniform);
  }

  public bindThematicSensors(uniform: UniformHandle): void {
    if (undefined !== this._sensors)
      this._sensors.bindTexture(uniform);
  }

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

  public bindUniformColorOverride(uniform: UniformHandle): void {
    if (sync(this, uniform))
      return;

    if (undefined !== this._overrides) {
      const uo = this._overrides.getUniformOverrides();
      if (uo[0] & OvrFlags.Rgb) {
        scratchRgb[0] = uo[4] / 255.0;
        scratchRgb[1] = uo[5] / 255.0;
        scratchRgb[2] = uo[6] / 255.0;
        uniform.setUniform3fv(scratchRgb);
      } else {
        uniform.setUniform3fv(noOverrideRgb);
      }
    } else {
      uniform.setUniform3fv(noOverrideRgb);
    }
  }

  public bindUniformTransparencyOverride(uniform: UniformHandle): void {
    if (sync(this, uniform))
      return;

    if (undefined !== this._overrides) {
      const uo = this._overrides.getUniformOverrides();
      if (uo[0] & OvrFlags.Alpha) {
        uniform.setUniform1f(uo[7]/255.0);
      } else {
        uniform.setUniform1f(-1.0);
      }
    } else {
      uniform.setUniform1f(-1.0);
    }
  }

  public bindUniformNonLocatable(uniform: UniformHandle, ignoreNonLocatable: boolean): void {
    if (sync(this, uniform))
      return;

    let nonLocatable = 0;
    if (!ignoreNonLocatable && undefined !== this._overrides) {
      const uo = this._overrides.getUniformOverrides();
      nonLocatable = (uo[0] & OvrFlags.NonLocatable) ? 1 : 0;
    }
    uniform.setUniform1i(nonLocatable);
  }
}
