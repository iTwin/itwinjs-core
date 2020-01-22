/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import {
  Range3d,
  Transform,
} from "@bentley/geometry-core";
import {
  ElementAlignedBox3d,
  TileProps,
} from "@bentley/imodeljs-common";
import { Tile, TileTree } from "./internal";

/**
 * Parameters used to construct a Tile.
 * @internal
 */
export interface TileParams {
  readonly root: TileTree;
  readonly contentId: string;
  readonly range: ElementAlignedBox3d;
  readonly maximumSize: number;
  readonly isLeaf?: boolean;
  readonly parent?: Tile;
  readonly contentRange?: ElementAlignedBox3d;
  readonly transformToRoot?: Transform;
  readonly sizeMultiplier?: number;
}

/** @internal */
export function tileParamsFromJSON(props: TileProps, root: TileTree, parent?: Tile): TileParams {
  const contentRange = undefined !== props.contentRange ? Range3d.fromJSON<ElementAlignedBox3d>(props.contentRange) : undefined;
  const transformToRoot = undefined !== props.transformToRoot ? Transform.fromJSON(props.transformToRoot) : undefined;
  return {
    root,
    contentId: props.contentId,
    range: Range3d.fromJSON(props.range),
    maximumSize: props.maximumSize,
    isLeaf: props.isLeaf,
    parent,
    contentRange,
    transformToRoot,
    sizeMultiplier: props.sizeMultiplier,
  };
}
