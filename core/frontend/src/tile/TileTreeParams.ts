/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import { Id64String } from "@bentley/bentleyjs-core";
import {
  ClipVector,
  Range3d,
  Transform,
} from "@bentley/geometry-core";
import {
  ElementAlignedBox3d,
  TileProps,
  TileTreeProps,
} from "@bentley/imodeljs-common";
import { IModelConnection } from "../IModelConnection";
import { TileLoader } from "./internal";

/**
 * Parameters used to construct a TileTree
 * @internal
 */
export interface TileTreeParams {
  readonly id: string;
  readonly rootTile: TileProps;
  readonly iModel: IModelConnection;
  readonly is3d: boolean;
  readonly loader: TileLoader;
  readonly location: Transform;
  readonly modelId: Id64String;
  readonly maxTilesToSkip?: number;
  readonly yAxisUp?: boolean;
  readonly clipVector?: ClipVector;
  readonly contentRange?: ElementAlignedBox3d;
}

/** Create TileTree.Params from JSON and context.
 * @internal
 */
export function tileTreeParamsFromJSON(props: TileTreeProps, iModel: IModelConnection, is3d: boolean, loader: TileLoader, modelId: Id64String): TileTreeParams {
  const contentRange = undefined !== props.contentRange ? Range3d.fromJSON<ElementAlignedBox3d>(props.contentRange) : undefined;
  return {
    id: props.id,
    rootTile: props.rootTile,
    iModel,
    is3d,
    loader,
    location: Transform.fromJSON(props.location),
    modelId,
    maxTilesToSkip: props.maxTilesToSkip,
    yAxisUp: props.yAxisUp,
    contentRange,
  };
}
