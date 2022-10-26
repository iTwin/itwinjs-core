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

const signature = new Uint8Array("MESH".split("").map((ch) => ch.charCodeAt(0)));
const headerSignature = new Uint32Array(signature.buffer)[0];

export function readElementMeshes(_data: Uint8Array): IndexedPolyface[] {
  return []; // ###TODO
}
