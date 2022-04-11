/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Geometry
 */

import { BentleyStatus, CompressedId64Set, Id64Array, Id64String } from "@itwin/core-bentley";
import { XYZProps } from "@itwin/core-geometry";

/** Specify whether to accumulate volumes, areas, or lengths for the supplied elements.
 * @public
 * @extensions
 */
export enum MassPropertiesOperation {
  /** Return lengths for open paths and planar regions. */
  AccumulateLengths = 0,
  /** Return areas and perimeters for solid and surface geometry. */
  AccumulateAreas = 1,
  /** Return volumes and areas for solid geometry. */
  AccumulateVolumes = 2,
}

/** Information required to request mass properties for elements from the front end to the back end.
 * @public
 * @extensions
 */
export interface MassPropertiesRequestProps {
  operation: MassPropertiesOperation;
  candidates?: Id64Array;
}

/** Information required to request mass properties for each element separately from the front end to the back end.
 * @public
 */
export interface MassPropertiesPerCandidateRequestProps {
  operations: MassPropertiesOperation[];
  candidates: CompressedId64Set;
}

/** Information returned from the back end to the front end holding the result of the mass properties calculation.
 * @public
 * @extensions
 */
export interface MassPropertiesResponseProps {
  /** Success if requested [[MassPropertiesOperation]] could be evaluated for the specified elements */
  status: BentleyStatus;
  /** Volume of solids when [[MassPropertiesOperation.AccumulateVolumes]] requested */
  volume?: number;
  /** Surface area of solids and surfaces when [[MassPropertiesOperation.AccumulateVolumes]] or [[MassPropertiesOperation.AccumulateAreas]] requested */
  area?: number;
  /** Perimeter of surfaces and planar regions when [[MassPropertiesOperation.AccumulateAreas]] requested */
  perimeter?: number;
  /** Length of curves or perimeter of planar regions when [[MassPropertiesOperation.AccumulateAreas]] or [[MassPropertiesOperation.AccumulateLength]] requested */
  length?: number;
  /** Centroid of geometry */
  centroid?: XYZProps;
  /** Product of inertia with respect to xy plane */
  ixy?: number;
  /** Product of inertia with respect to xz plane */
  ixz?: number;
  /** Product of inertia with respect to yz plane */
  iyz?: number;
  /** Moments of inertia */
  moments?: XYZProps;
}

/** Information returned from the back end to the front end holding the result of the mass properties calculation for a single candidate.
 * @public
 */
export interface MassPropertiesPerCandidateResponseProps extends MassPropertiesResponseProps {
  candidate: Id64String;
}
