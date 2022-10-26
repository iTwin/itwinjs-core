/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Geometry
 */

import { IndexedPolyface } from "@itwin/core-geometry";

export interface ElementMeshOptions {
  chordTolerance?: number;
  angleTolerance?: number;
  decimationTolerance?: number;
  minBRepFeatureSize?: number;
}

export function readElementMeshes(_data: Uint8Array): IndexedPolyface[] {
  return []; // ###TODO
}
