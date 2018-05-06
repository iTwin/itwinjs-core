/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module SqlFuncs */

import { XYZProps, Range3dProps } from "@bentley/geometry-core";
import { Placement3d } from "./geometry/Primitives";

/** Get a member of a iModel_Point object.
 * @param point    The point to query
 * @param member   The index of the coordinate to get: X=0, Y=1, Z=2
 * @return a coordindate of the point in meters; or an error if \a member is out of range or \a point is not a point object
 */
export function iModel_point_value(point: XYZProps, member: number): number { point; member; return 0; }

/**
 * Get the axis-aligned bounding box from a placement
 * @param placement   The iModel_placement object to query
 * @return the bounding box
 */
export function iModel_placement_aabb(placement: Placement3d): Range3dProps { placement; return {} as any; }
