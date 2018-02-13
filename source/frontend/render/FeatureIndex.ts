/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

export const enum FeatureIndexType {
  kEmpty,
  kUniform,
  kNonUniform,
}

export class FeatureIndex {
  public type: FeatureIndexType = FeatureIndexType.kEmpty;
  public featureID: number = 0;
  public featureIDs: Uint32Array | undefined = undefined;

  public constructor() {
    this.reset();
  }

  public isUniform(): boolean { return FeatureIndexType.kUniform === this.type; }
  public isEmpty(): boolean { return FeatureIndexType.kEmpty === this.type; }
  public reset(): void { this.type = FeatureIndexType.kEmpty; this.featureID = 0; this.featureIDs = undefined; }
}
