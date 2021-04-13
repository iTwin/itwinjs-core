/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Matrix3d, Point3d, XAndY } from "@bentley/geometry-core";
import { ColorDef } from "@bentley/imodeljs-common";

export interface PlanarGridProps {
  origin: Point3d;
  rMatrix: Matrix3d;
  spacing: XAndY;
  gridsPerRef: number;
  color: ColorDef;
  planeTransparency: number;
  refTransparency: number;      // Reference line transparency (0-255)
  lineTransparency: number;     // Line transparency (0-255)
}
