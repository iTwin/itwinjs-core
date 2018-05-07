/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module SqlFuncs */

import { Range3dProps, Point3d } from "@bentley/geometry-core";
import { Placement3d } from "./geometry/Primitives";

/** Get a member of a iModel_Point object.
 * @param point    The point to query
 * @param member   The index of the coordinate to get: X=0, Y=1, Z=2
 * @return a coordindate of the point in meters; or an error if `member` is out of range or `point` is not a point object
 */
export function iModel_point_value(point: Point3d, member: number): number { point; member; return 0; }

/**
 * Get the axis-aligned bounding box from a placement
 * @param placement   The placement object to query
 * @return the bounding box
 */
export function iModel_placement_aabb(placement: Placement3d): Range3dProps { placement; return {} as any; }

/**
 * Get the element-aligned bounding box from a placement
 * @param placement   The placement object to query
 * @return the bounding box
 */
export function iModel_placement_eabb(placement: Placement3d): Range3dProps { placement; return {} as any; }

/**
 * Get the placement origin
 * @param placement   The placement object to query
 * @return the origin in world coordinates
 */
export function iModel_placement_origin(placement: Placement3d): Point3d { placement; return {} as any; }

/**
 * Get the placement angles
 * @param placement   The iModel_placement object to query
 * @return the placement angles
 */
export function iModel_placement_angles(placement: Placement3d): YawPitchRoll { placement; return {} as any; }

/**
 * Construct a YawPitchRoll object from 3 values
 * @param yaw The Yaw angle in degrees
 * @param pitch The Pitch angle in degrees
 * @param roll The Roll angle in degrees
 * @return a iModel_angles object
 */
export function iModel_angles(yaw: number, pitch: number, roll: number): YawPitchRoll { yaw; pitch; roll; return {} as any; }

/**
 * Get a member of a iModel_angles object
 * @param angles   The iModel_angles object to query
 * @param member   The index of the member to get: Yaw=0, Pitch=1, Roll=2
 * @return the selected angle (in degrees); or an error if member is out of range or if `angles` is not a iModel_angles object
 */
export function iModel_angles_value(angles: YawPitchRoll, member: number): number { angles; member; return 0; }

/**
 * Return the maximum absolute difference among the angles in degrees.
 * @param angle1 a iModel_angles object
 * @param angle2 a iModel_angles object
 * @return the maximum absolute difference among the angles in degrees.
 */
export function iModel_angles_maxdiff(angle1: number, angle2: number): number { angle1; angle2; return 0; }

/**
 * Create a bounding box from 6 values
 * All coordinates are in meters.
 * @param xLow     The low X coordinate of the bounding box
 * @param yLow     The low Y coordinate of the bounding box
 * @param zlow     The low Z coordinate of the bounding box
 * @param xHigh    The high X coordinate of the bounding box
 * @param yHigh    The high Y coordinate of the bounding box
 * @param zHigh    The high Z coordinate of the bounding box
 * @return a iModel_bbox object
 */
export function iModel_bbox(xLow: number, yLow: number, zLow: number, xHigh: number, yHigh: number, zHigh: number): Range3dProps { xLow; yLow; zLow; xHigh; yHigh; zHigh; return {} as any; }

/**
 * Compute the "width" of a bounding box
 * @param bb       a bounding box
 * @return the difference between the high and low X coordinates of the box, in meters.
 * @see iModel_bbox_areaxy
 */
export function iModel_bbox_width(bb: Range3dProps): number { bb; return 0; }

/**
 * Compute the "height" of a bounding box
 * @param bb       a bounding box
 * @return the difference between the high and low Z coordinates of the box, in meters.
 * @see iModel_bbox_areaxy
 */
export function iModel_bbox_height(bb: Range3dProps): number { bb; return 0; }

/**
 * Compute the "depth" of a bounding box
 * @param bb       a bounding box
 * @return the difference between the high and low Y coordinates of the box, in meters.
 * @see iModel_bbox_areaxy
 */
export function iModel_bbox_depth(bb: Range3dProps): number { bb; return 0; }

/**
 * Compute the volume of the bounding box
 * @param bb       a bounding box
 * @return Its volume in cubic meters
 * @see iModel_bbox_areaxy
 */
export function iModel_bbox_volume(bb: Range3dProps): number { bb; return 0; }

/**
 * Compute the depth times the width of a bounding box
 * @param bb       a bounding box
 * @return the depth of \a bb times its width; or, an error if the input object is not a iModel_bbox
 * @see iModel_bbox_volume
 * @see iModel_bbox_depth, iModel_bbox_width
 */
export function iModel_bbox_areaxy(bb: Range3dProps): number { bb; return 0; }

/**
 * Determine if the areas enclosed by two 3-D bounding boxes overlap
 * @param bb1       The first bounding box
 * @param bb2       The second bounding box
 * @return 1 if the boxes overlap or 0 if not.
 * @see iModel_bbox_contains
 */
export function iModel_bbox_overlaps(bb1: Range3dProps, bb2: Range3dProps): number { bb1; bb2; return 0; }
