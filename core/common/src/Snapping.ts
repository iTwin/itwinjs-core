/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Views */

import { Id64Props } from "@bentley/bentleyjs-core";
import { XYZProps, Matrix4dProps, TransformProps } from "@bentley/geometry-core";

export interface SnapRequestProps {
  id: Id64Props;
  closePoint: XYZProps;
  worldToView: Matrix4dProps;
  viewFlags?: any;
  snapMode?: number;
  snapAperture?: number;
  snapDivisor?: number;
  offSubCategories?: string[];
}

export interface SnapResponseProps {
  status: number;
  heat?: number;
  geomType?: number;
  parentGeomType?: number;
  subCategory?: string;
  weight: number;
  snapPoint?: XYZProps;
  curve?: any;
  localToWorld?: TransformProps;
  normal?: XYZProps;
}
