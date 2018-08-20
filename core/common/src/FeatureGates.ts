/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module FeatureGates */

/**
 * A set of "gates" that can enable or disable [features at runtime]($docs/learning/common/FeatureGates.md).
 */
export class FeatureGates {
  private readonly _gates: any = {};

  /**
   * Get the value of a potentially gated feature.
   * @param feature the name of the feature to check. May be a "path" of period-separated feature sub-groups (e.g. "feature1.groupA.showMe").
   *       Feature names are case-sensitive.
   * @param defaultVal optionally, value to return if feature is undefined.
   */
  public check(feature: string, defaultVal?: any): any {
    if (feature.length === 0)
      return defaultVal;

    let gate: any = this._gates;
    for (const name of feature.split(".")) {
      gate = gate[name];
      if (typeof gate !== "object")
        break;
    }
    switch (typeof gate) {
      case "undefined":
        return defaultVal;
      case "object":
        return Object.assign(gate); // always return a copy of objects so caller doesn't accidentally change their value.
    }
    return gate;
  }

  /**
   * Gate access to a feature.
   * @param feature the name of the feature to gate. May be a "path" of period-separated feature sub-groups (e.g. "feature1.groupA.showMe").
   *  Feature names are case-sensitive.
   * @param val value to set
   */
  public setGate(feature: string, val: any): void {
    if (feature.length === 0 || typeof val === "undefined")
      return;

    let gate: any = this._gates;
    const arr = feature.split(".");
    while (arr.length > 1) {
      const obj = gate[arr[0]];
      if (typeof obj !== "object")
        gate[arr[0]] = {};
      gate = gate[arr.shift()!];
    }

    gate[arr[0]] = val;
  }
}
