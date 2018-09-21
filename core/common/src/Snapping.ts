/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Views */

import { Id64Props } from "@bentley/bentleyjs-core";
import { XYZProps, Matrix4dProps, TransformProps } from "@bentley/geometry-core";

/**
 * Information required to request a *snap* to an element from the front end to the back end.
 * Includes the viewing parameters so that snap can be relative to the view direction, viewing mode, etc.
 */
export interface SnapRequestProps {
  id: Id64Props;
  closePoint: XYZProps;
  worldToView: Matrix4dProps;
  viewFlags?: any;
  snapModes?: number[];
  snapAperture?: number;
  snapDivisor?: number;
  offSubCategories?: string[];
}

/**
 * Information returned from the back end to the front end holding the result of a *snap* operation.
 */
export interface SnapResponseProps {
  status: number;
  snapMode?: number;
  heat?: number;
  geomType?: number;
  parentGeomType?: number;
  subCategory?: string;
  hitPoint?: XYZProps;
  snapPoint?: XYZProps;
  normal?: XYZProps;
  curve?: any;
  localToWorld?: TransformProps;
}
