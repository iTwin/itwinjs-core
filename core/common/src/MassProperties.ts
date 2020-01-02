/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WireFormats */

import { Id64Array, BentleyStatus } from "@bentley/bentleyjs-core";
import { XYZProps } from "@bentley/geometry-core";

/** Specify whether to accumulate volumes, areas, or lengths for the supplied elements.
 * @beta
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
 * @beta
 */
export interface MassPropertiesRequestProps {
  operation: MassPropertiesOperation;
  candidates?: Id64Array;
}

/** Information returned from the back end to the front end holding the result of the mass properties calculation.
 * @beta
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
