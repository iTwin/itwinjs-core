/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import {
  FeatureIndexType,
  FeatureIndex,
} from "@bentley/imodeljs-common";
import { VertexTable } from "../primitives/VertexTable";
import { assert } from "@bentley/bentleyjs-core";

/** @internal */
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

  public static createFromVertexTable(vt: VertexTable): FeaturesInfo | undefined {
    switch (vt.featureIndexType) {
      case FeatureIndexType.Empty: return undefined;
      case FeatureIndexType.NonUniform: return FeaturesInfo._nonUniform;
      default:
        assert(undefined !== vt.uniformFeatureID);
        return new FeaturesInfo(vt.uniformFeatureID!);
    }
  }

  public static createFromFeatureIds(ids?: Uint8Array): FeaturesInfo | undefined {
    if (undefined === ids || 0 === ids.length)
      return undefined;

    assert(0 === ids.length % 3);
    const nFeatures = ids.length / 3;
    for (let i = 1; i < nFeatures; i++) {
      const index = i * 3;
      if (ids[index + 0] !== ids[0] || ids[index + 1] !== ids[1] || ids[index + 2] !== ids[2])
        return FeaturesInfo._nonUniform;
    }

    const uniform = ids[0] | (ids[1] << 8) | (ids[2] << 16);
    return FeaturesInfo.createUniform(uniform);
  }

  public get type(): FeatureIndexType { return undefined !== this.uniform ? FeatureIndexType.Uniform : FeatureIndexType.NonUniform; }
  public get isUniform() { return FeatureIndexType.Uniform === this.type; }
  public get isNonUniform() { return !this.isUniform; }

  private constructor(uniform?: number) { this.uniform = uniform; }

  private static _nonUniform = new FeaturesInfo(undefined);
}
