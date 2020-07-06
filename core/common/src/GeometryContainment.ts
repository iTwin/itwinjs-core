/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Geometry
 */

import { BentleyStatus, Id64Array } from "@bentley/bentleyjs-core";
import { ViewFlagProps } from "./ViewFlags";

/** Information required to request clip containment status for elements from the front end to the back end.
 * @beta
 */
export interface GeometryContainmentRequestProps {
  candidates: Id64Array;
  clip: any; // json representing a ClipVector
  allowOverlaps?: boolean;
  viewFlags?: ViewFlagProps;
  offSubCategories?: Id64Array;
}

/** Information returned from the back end to the front end holding the result of the geometry containment query.
 * @beta
 */
export interface GeometryContainmentResponseProps {
  status: BentleyStatus;
  candidatesContainment?: number[]; // ClipPlaneContainment status for candidate array entry at the same index.
  numInside?: number;
  numOutside?: number;
  numOverlap?: number;
}
