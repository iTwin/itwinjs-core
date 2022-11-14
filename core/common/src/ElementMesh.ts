/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Geometry
 */

import { Id64String } from "@itwin/core-bentley";
import { IndexedPolyface } from "@itwin/core-geometry";
import { JsonGeometryStream, FlatBufferGeometryStream } from "./tile/ElementGraphics";

export interface ElementMeshOptions {
  chordTolerance?: number;
  angleTolerance?: number;
  decimationTolerance?: number;
  minBRepFeatureSize?: number;
}

export interface PersistentElementMeshSource {
  elementId: Id64String;
  geometry?: never;
  categoryId?: never;
}

export interface DynamicElementMeshSource {
  geometry: JsonGeometryStream | FlatBufferGeometryStream;
  categoryId: Id64String;
  elementId?: never;
}

export interface ElementMeshRequestProps extends ElementMeshOptions {
  source: PersistentElementMeshSource | DynamicElementMeshSource;
}

export function readElementMeshes(_data: Uint8Array): IndexedPolyface[] {
  return []; // ###TODO
}
