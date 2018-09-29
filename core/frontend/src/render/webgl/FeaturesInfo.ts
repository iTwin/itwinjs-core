/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import {
  FeatureIndexType,
  FeatureIndex,
} from "@bentley/imodeljs-common";
import { VertexTable } from "../primitives/VertexTable";
import { assert } from "@bentley/bentleyjs-core";

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

  public get type(): FeatureIndexType { return undefined !== this.uniform ? FeatureIndexType.Uniform : FeatureIndexType.NonUniform; }
  public get isUniform() { return FeatureIndexType.Uniform === this.type; }
  public get isNonUniform() { return !this.isUniform; }

  private constructor(uniform?: number) { this.uniform = uniform; }

  private static _nonUniform = new FeaturesInfo(undefined);
}
