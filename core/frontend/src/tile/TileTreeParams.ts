/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import {
  BeDuration,
  Id64String,
} from "@bentley/bentleyjs-core";
import { Transform } from "@bentley/geometry-core";
import {
  ElementAlignedBox3d,
} from "@bentley/imodeljs-common";
import { IModelConnection } from "../IModelConnection";
import { RenderClipVolume } from "../render/RenderClipVolume";
import { TileLoadPriority } from "./internal";

/**
 * Parameters used to construct a TileTree
 * @internal
 */
export interface TileTreeParams {
  id: string;
  modelId: Id64String;
  iModel: IModelConnection;
  location: Transform;
  clipVolume?: RenderClipVolume;
  priority: TileLoadPriority;
  contentRange?: ElementAlignedBox3d;
  expirationTime?: BeDuration;
}
