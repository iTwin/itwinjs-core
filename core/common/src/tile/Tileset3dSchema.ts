/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import { RequireAtLeastOne } from "@itwin/core-bentley";

/** The schema describing a 3d tileset per the [3d tiles specification](https://github.com/CesiumGS/3d-tiles/blob/main/specification/schema/tileset.schema.json).
 * @alpha
 */
export namespace Tileset3dSchema {
  /** An object that can be defined on any [[TilesetProperty]] to provide extensions to the core spec. */
  export interface Extensions {
    [key: string]: any;
  }

  /** An extensible property of a [[Tileset]]. Most types within the schema are extensible. */
  export interface TilesetProperty {
    extensions?: Extensions;
    extras?: any;
  }

  export type BoundingSphere = [
    centerX: number, centerY: number, centerZ: number, radius: number
  ];

  export type BoundingRegion = [
    west: number, south: number, east: number, north: number, minHeight: number, maxHeight: number
  ];

  export type BoundingBox = [
    centerX: number, centerY: number, centerZ: number,
    uX: number, uY: number, uZ: number,
    vX: number, vY: number, vZ: number,
    wX: number, wY: number, wZ: number,
  ];

  export type BoundingVolume = RequireAtLeastOne<{
    box?: BoundingBox;
    sphere?: BoundingSphere;
    region?: BoundingRegion;
  }>;

  export type GeometricError = number;

  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  export type Refinement = "ADD" | "REPLACE" | string;

  export type Transform = [
    number, number, number, number,
    number, number, number, number,
    number, number, number, number,
    number, number, number, number,
  ];

  export interface Content extends TilesetProperty {
    uri: string;
    boundingVolume?: BoundingVolume;
  }

  export interface Tile extends TilesetProperty {
    boundingVolume: BoundingVolume;
    geometricError: GeometricError;
    viewerRequestVolume?: BoundingVolume;
    refine?: Refinement;
    transform?: Transform;
    content?: Content;
    children?: Tile[];
  }

  export interface Asset extends TilesetProperty {
    version: string;
    tilesetVersion?: string;
  }

  export interface Tileset extends TilesetProperty {
    asset: Asset;
    geometricError: GeometricError;
    properties: unknown; // currently unused.
    root: Tile;
    extensionsUsed?: string[];
    extensionsRequired?: string[];
  }
}
