/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Rendering */

import { QParams3d, FeatureIndex } from "@bentley/imodeljs-common";
import { Mesh } from "./mesh/MeshPrimitives";

export class PointCloudArgs {
  public points: Uint16Array;
  public pointParams: QParams3d;
  public colors: Uint8Array;
  public features: FeatureIndex = new FeatureIndex();

  public constructor(points: Uint16Array, pointParams: QParams3d, colors: Uint8Array, features: Mesh.Features) {
    this.points = points;
    this.colors = colors;
    this.pointParams = pointParams;
    features.toFeatureIndex(this.features);
  }
}
