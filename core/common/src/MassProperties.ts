/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Geometry
 */

import { BentleyStatus, Id64Array } from "@bentley/bentleyjs-core";
import { XYZProps } from "@bentley/geometry-core";

/** Specify whether to accumulate volumes, areas, or lengths for the supplied elements.
 * @public
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
 */
export interface MassPropertiesRequestProps {
  operation: MassPropertiesOperation;
  candidates?: Id64Array;
}

/** Information returned from the back end to the front end holding the result of the mass properties calculation.
 * @public
 */
export interface MassPropertiesResponseProps {
  status: BentleyStatus;
  volume?: number;
  area?: number;
  perimeter?: number;
  length?: number;
  centroid?: XYZProps;
  ixy?: number;
  ixz?: number;
  iyz?: number;
  moments?: XYZProps;
}
