/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { ImdlFlags } from "@itwin/core-common";

// Describes a single tile.
export interface TileTestCase {
  readonly bytes: Uint8Array;
  readonly flags: ImdlFlags;
}

// Describes a set of tiles generated for a particular version of the tile format from a set of simple iModels.
export interface TileTestData {
  readonly versionMajor: number;
  readonly versionMinor: number;
  readonly headerLength: number;
  unreadable?: true;

  // Binary data for a tile created for a model containing a single element: a green rectangle in the range [0,0] to [5,10]
  // A single element: a green rectangle in the range [0,0] to [5,10]
  readonly rectangle: TileTestCase;

  // A single open yellow line string with following points (z==0 for all):
  // (0,10) (0,-10) (5,0) (5,10) (15,-10),(15,0)
  readonly lineString: TileTestCase;

  // 3 line strings. The first has same coordinates as lineString above. The second has same coordinates with -10 added to each y. The third same as first with -20 added to y.
  // First: line code = 2; color = yellow; width = 8
  // Second: line code = 2; color = cyan; width = 8
  // Third: line code = 0 (solid); color = purple; width = 8
  readonly lineStrings: TileTestCase;

  // 3 line strings. The first has same coordinates as lineString above. The second has same coordinates with -10 added to each y. The third same as first with -20 added to y.
  // First: line code = 2; color = yellow; width = 8
  // Second: line code = 2; color = cyan; width = 8
  // Third: line code = 0 (solid); color = purple; width = 8
  // 6 triangles arranged in two rows of 3.
  // top-left triangle has coordinates (0,0,0) (0,10,0) (5,0,0). Add 5 to x to get coords of 2nd and 3rd in row.
  // Bottom left same coords as top-left except add -10 to y. Add 5 to x to get coords of 2nd and 3rd in row.
  // colors: left=red middle=green right=blue
  // Bottom row has 50% transparency.
  readonly triangles: TileTestCase;

  // Binary data for a tile created for a model containing a single element: a green cylinder.
  // Center1 = (0,0,0) Center2 = (0,0,6) Radius = 2
  readonly cylinder: TileTestCase;
}
