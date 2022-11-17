/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Geometry
 */

import { Id64String } from "@itwin/core-bentley";
import { IndexedPolyface } from "@itwin/core-geometry";

export interface ElementMeshOptions {
  chordTolerance?: number;
  angleTolerance?: number;
  minBRepFeatureSize?: number;
  // ###TODO? decimationTolerance?: number;
}

export interface ElementMeshRequestProps extends ElementMeshOptions {
  source: Id64String;
}

export function readElementMeshes(_data: Uint8Array): IndexedPolyface[] {
  return []; // ###TODO
}
