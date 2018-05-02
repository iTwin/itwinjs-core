/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { FeatureIndexType,
         FeatureIndex } from "@bentley/imodeljs-common";

export class FeaturesInfo {
  public uniform = 0;
  public type: FeatureIndexType;

  public constructor(srcOrType?: FeatureIndex | FeatureIndexType, uniform?: number) {
    if (srcOrType instanceof FeatureIndex) {
      this.uniform = srcOrType.featureID;
      this.type = srcOrType.type;
    } else if (srcOrType !== undefined && uniform) {
      this.uniform = uniform;
      this.type = srcOrType;
    } else {
      this.type = FeatureIndexType.Empty;
    }
  }
  public isEmpty() { return FeatureIndexType.Empty === this.type; }
  public isUniform() { return FeatureIndexType.Uniform === this.type; }
  public isNonUniform() { return FeatureIndexType.NonUniform === this.type; }

  public setUniform(uniform: number) { this.type = FeatureIndexType.Uniform; this.uniform = uniform; }
  public clear() { this.type = FeatureIndexType.Empty; }
}
