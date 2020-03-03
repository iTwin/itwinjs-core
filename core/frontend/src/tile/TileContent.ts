/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import { ElementAlignedBox3d } from "@bentley/imodeljs-common";
import { RenderGraphic } from "../render/RenderGraphic";

/**
 * Describes the contents of a [[Tile]]. Specific sub-types of [[Tile]] may describe their content using sub-types of this interface.
 * @internal
 */
export interface TileContent {
  /** Graphical representation of the tile's geometry. */
  graphic?: RenderGraphic;
  /** Bounding box tightly enclosing the tile's geometry. */
  contentRange?: ElementAlignedBox3d;
  /** True if this tile requires no subdivision or refinement. */
  isLeaf?: boolean;
}
