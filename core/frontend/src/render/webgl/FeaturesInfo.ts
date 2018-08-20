/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import {
  FeatureIndexType,
  FeatureIndex,
} from "@bentley/imodeljs-common";

export class FeaturesInfo {
  public readonly uniform?: number;

  public static create(featureIndex: FeatureIndex): FeaturesInfo | undefined {
    switch (featureIndex.type) {
      case FeatureIndexType.Empty: return undefined;
      case FeatureIndexType.Uniform: return new FeaturesInfo(featureIndex.featureID);
      default: return FeaturesInfo._nonUniform;
    }
  }
  public static createUniform(id: number): FeaturesInfo { return new FeaturesInfo(id); }

  public get type(): FeatureIndexType { return undefined !== this.uniform ? FeatureIndexType.Uniform : FeatureIndexType.NonUniform; }
  public get isUniform() { return FeatureIndexType.Uniform === this.type; }
  public get isNonUniform() { return !this.isUniform; }

  private constructor(uniform?: number) { this.uniform = uniform; }

  private static _nonUniform = new FeaturesInfo(undefined);
}
