/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { BeEvent } from "@bentley/bentleyjs-core";

/**
 * @hidden
 */
export type GateValue = number | boolean | string | undefined;

/**
 * A set of "gates" that can enable or disable features at runtime.
 * @hidden
 */
export class FeatureGates {
  /** Event raised every time any feature changes. */
  public onChanged = new BeEvent<(feature: string, val: GateValue) => void>();

  /** A map of the current set of features. */
  public readonly gates = new Map<string, GateValue>();

  /**
   * Get the value of a potentially gated feature.
   * @param feature The name of the feature to check. May be a "path" of period-separated feature sub-groups (e.g. "feature1.groupA.showMe").
   *       Feature names are case-sensitive.
   * @param defaultVal Optionally, value to return if feature is undefined.
   */
  public check(feature: string, defaultVal?: GateValue): GateValue {
    const val = this.gates.get(feature);
    return val === undefined ? defaultVal : val;
  }

  /**
   * Gate access to a feature.
   * @param feature The name of the feature to gate. May be a "path" of period-separated feature sub-groups (e.g. "feature1.groupA.showMe").
   *  Feature names are case-sensitive.
   * @param val Value to set. If undefined, feature is deleted.
   */
  public setGate(feature: string, val: GateValue): void {
    if (feature.length === 0)
      return;
    if (val === undefined)
      this.gates.delete(feature);
    else
      this.gates.set(feature, val);

    this.onChanged.raiseEvent(feature, val);
  }

  /**
   * Register a listener to be called whenever the value of a specific gate changes.
   * @param feature The name of the feature to monitor
   * @param monitor The listener to call when `feature` changes. Receives a single argument holding the new value of the feature (may be undefined).
   * @returns A function that may be called to remove the listener.
   * @note Use [[onChanged]] to listen to changes for *all* gates.
   */
  public addMonitor(feature: string, monitor: (val: GateValue) => void): () => void { return this.onChanged.addListener((changed, val) => { if (changed === feature) monitor(val); }); }
}
