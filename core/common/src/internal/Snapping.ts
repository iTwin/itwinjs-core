/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Geometry
 */

import { Id64Array, Id64String } from "@itwin/core-bentley";
import { Matrix4dProps, TransformProps, XYZProps } from "@itwin/core-geometry";
import { GeometryStreamProps } from "../geometry/GeometryStream";
import { GeometryClass } from "../GeometryParams";
import { ViewFlagProps } from "../ViewFlags";

/** Information required to request a *snap* to a pickable decoration from the front end to the back end.
 * @internal RPC glue.
 */
export interface DecorationGeometryProps {
  readonly id: Id64String;
  readonly geometryStream: GeometryStreamProps;
}

/** Information required to request a *snap* to an element from the front end to the back end.
 * Includes the viewing parameters so that snap can be relative to the view direction, viewing mode, etc.
 * @internal RPC glue.
 */
export interface SnapRequestProps {
  id: Id64String;
  testPoint: XYZProps;
  closePoint: XYZProps;
  worldToView: Matrix4dProps;
  viewFlags?: ViewFlagProps;
  snapModes?: number[];
  snapAperture?: number;
  snapDivisor?: number;
  subCategoryId?: Id64String;
  geometryClass?: GeometryClass;
  intersectCandidates?: Id64Array;
  decorationGeometry?: DecorationGeometryProps[];
  /** A transform to be applied to the snap geometry.
   * testPoint, closePoint, and worldToView are in "world" coordinates (the coordinates of the viewport's iModel).
   * The snap geometry is in "model" coordinates (the coordinates of the iModel to which we're snapping).
   * In normal cases these are the same iModel. They may differ when people draw multiple iModels into the same viewport.
   */
  modelToWorld?: TransformProps;
}

/** Information returned from the back end to the front end holding the result of a *snap* operation.
 * @internal RPC glue.
 */
export interface SnapResponseProps {
  status: number;
  snapMode?: number;
  heat?: number;
  geomType?: number;
  parentGeomType?: number;
  hitPoint?: XYZProps;
  snapPoint?: XYZProps;
  normal?: XYZProps;
  curve?: any;
  intersectCurve?: any;
  intersectId?: string;
}
