/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Arc3d, Loop, Path, Point3d, Polyface, SolidPrimitive } from "@itwin/core-geometry";
import { ColorDef, LinePixels } from "@itwin/core-common";

export interface SymbologySnapshot {
  lineColor?: ColorDef;
  fillColor?: ColorDef;
  width?: number;
  linePixels?: LinePixels;
}

export interface PointStringEntry {
  type: "pointstring";
  points: Point3d[];
  symbology: SymbologySnapshot;
}

export interface LineStringEntry {
  type: "linestring";
  points: Point3d[];
  symbology: SymbologySnapshot;
}

export interface ShapeEntry {
  type: "shape";
  points: Point3d[];
  symbology: SymbologySnapshot;
}

export interface ArcEntry {
  type: "arc";
  arc: Arc3d;
  isEllipse: boolean;
  filled: boolean;
  symbology: SymbologySnapshot;
}

export interface PathEntry {
  type: "path";
  path: Path;
  symbology: SymbologySnapshot;
}

export interface LoopEntry {
  type: "loop";
  loop: Loop;
  symbology: SymbologySnapshot;
}

export interface PolyfaceEntry {
  type: "polyface";
  polyface: Polyface;
  filled: boolean;
  symbology: SymbologySnapshot;
}

export interface SolidPrimitiveEntry {
  type: "solidPrimitive";
  solidPrimitive: SolidPrimitive;
  symbology: SymbologySnapshot;
}

export type DecorationPrimitiveEntry =
  | PointStringEntry
  | LineStringEntry
  | ShapeEntry
  | ArcEntry
  | PathEntry
  | LoopEntry
  | PolyfaceEntry
  | SolidPrimitiveEntry;

