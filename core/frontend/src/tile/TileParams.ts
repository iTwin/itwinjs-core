/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import { ElementAlignedBox3d } from "@bentley/imodeljs-common";
import { Tile } from "./internal";

/**
 * Parameters used to construct a Tile.
 * @internal
 */
export interface TileParams {
  parent?: Tile;
  isLeaf?: boolean;
  contentId: string;
  range: ElementAlignedBox3d;
  contentRange?: ElementAlignedBox3d;
  maximumSize: number;
}
