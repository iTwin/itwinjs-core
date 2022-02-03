/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module LinearReferencing
 */

import type { Id64String } from "@itwin/core-bentley";

/** Interface with data returned by LinearElement.queryLinearLocations API
 * @beta
 */
export interface LinearLocationReference {
  startDistanceAlong: number;
  stopDistanceAlong: number;
  linearlyLocatedId: Id64String;
  linearlyLocatedClassFullName: string;
  locationAspectId: Id64String;
}

/** Enum capturing range-comparison options for from/to distanceAlong in QueryParams
 * @beta
 */
export enum ComparisonOption { Inclusive, Exclusive }

/** Enum enabling LinearElement.queryLinearLocations performance optimization when the target Linearly-Located classes are all either At or FromTo.
 * @beta
 */
export enum LinearlyReferencedLocationType { At, FromTo, Any }

/** Interface capturing various parameters for the execution of LinearElement.queryLinearLocations API
 * @beta
 */
export interface QueryParams {
  fromDistanceAlong?: number;
  fromComparisonOption?: ComparisonOption;
  toDistanceAlong?: number;
  toComparisonOption?: ComparisonOption;
  linearlyReferencedLocationTypeFilter?: LinearlyReferencedLocationType;
  linearlyLocatedClassFullNames?: string[];
}
