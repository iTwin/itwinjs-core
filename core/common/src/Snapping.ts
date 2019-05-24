/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Views */

import { Id64String, Id64Array } from "@bentley/bentleyjs-core";
import { XYZProps, Matrix4dProps } from "@bentley/geometry-core";
import { GeometryStreamProps } from "./geometry/GeometryStream";
import { GeometryClass } from "./Render";

/** Information required to request a *snap* to a pickable decoration from the front end to the back end.
 * @beta
 */
export class DecorationGeometry {
  public constructor(public readonly id: Id64String, public readonly geometryStream: GeometryStreamProps) { }
}

/** The data properties of DecorationGeometry. */
export interface DecorationGeometryProps extends Pick<DecorationGeometry, keyof DecorationGeometry> { }

/** Information required to request a *snap* to an element from the front end to the back end.
 * Includes the viewing parameters so that snap can be relative to the view direction, viewing mode, etc.
 * @beta
 */
export interface SnapRequestProps {
  id: Id64String;
  testPoint: XYZProps;
  closePoint: XYZProps;
  worldToView: Matrix4dProps;
  viewFlags?: any;
  snapModes?: number[];
  snapAperture?: number;
  snapDivisor?: number;
  subCategoryId?: Id64String;
  /** @alpha */
  geometryClass?: GeometryClass;
  intersectCandidates?: Id64Array;
  decorationGeometry?: DecorationGeometryProps[];
}

/** Information returned from the back end to the front end holding the result of a *snap* operation.
 * @beta
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
