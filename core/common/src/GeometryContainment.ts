/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Geometry
 */

import type { BentleyStatus, Id64Array } from "@itwin/core-bentley";
import type { ViewFlagProps } from "./ViewFlags";
import type { ClipPlaneContainment, ClipVectorProps } from "@itwin/core-geometry";

/** Information required to request clip containment status for elements from the front end to the back end.
 * @public
 */
export interface GeometryContainmentRequestProps {
  candidates: Id64Array;
  clip: ClipVectorProps;
  allowOverlaps?: boolean;
  viewFlags?: ViewFlagProps;
  offSubCategories?: Id64Array;
}

/** Information returned from the back end to the front end holding the result of the geometry containment query.
 * @public
 */
export interface GeometryContainmentResponseProps {
  status: BentleyStatus;
  candidatesContainment?: ClipPlaneContainment[]; // status for candidate array entry at the same index.
  numInside?: number;
  numOutside?: number;
  numOverlap?: number;
}
