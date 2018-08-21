
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module FeatureGates */

import { BeEvent } from "@bentley/bentleyjs-core";

export type GateValue = number | boolean | string | undefined;

/**
 * A set of "gates" that can enable or disable [features at runtime]($docs/learning/common/FeatureGates.md).
 */
export class FeatureGates {
  public onChanged = new BeEvent<(feature: string, val: GateValue) => void>();
  private readonly _gates = new Map<string, GateValue>();

  /**
   * Get the value of a potentially gated feature.
   * @param feature the name of the feature to check. May be a "path" of period-separated feature sub-groups (e.g. "feature1.groupA.showMe").
   *       Feature names are case-sensitive.
   * @param defaultVal optionally, value to return if feature is undefined.
   */
  public check(feature: string, defaultVal?: GateValue): GateValue {
    const val = this._gates.get(feature);
    return val === undefined ? defaultVal : val;
  }

  /**
   * Gate access to a feature.
   * @param feature the name of the feature to gate. May be a "path" of period-separated feature sub-groups (e.g. "feature1.groupA.showMe").
   *  Feature names are case-sensitive.
   * @param val value to set. If undefined, feature is deleted.
   */
  public setGate(feature: string, val: GateValue): void {
    if (feature.length === 0)
      return;
    if (val === undefined)
      this._gates.delete(feature);
    else
      this._gates.set(feature, val);

    this.onChanged.raiseEvent(feature, val);
  }

  /** Register a listener to be called whenever the value of a specific gate changes.
   * @param feature The name of the feature to monitor
   * @param monitor The listener to call when `feature` changes. Receives a single argument holding the new value of the feature (may be undefined).
   * @returns A function that may be called to remove the listener.
   */
  public addMonitor(feature: string, monitor: (val: GateValue) => void): () => void { return this.onChanged.addListener((changed, val) => { if (changed === feature) monitor(val); }); }
}
