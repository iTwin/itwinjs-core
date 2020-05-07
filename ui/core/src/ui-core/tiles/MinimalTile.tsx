/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import * as React from "react";
import { Tile, TileProps } from "./Tile";

/** Minimal [[Tile]] component
 * @beta
 */
export function MinimalTile(props: TileProps) {
  return <Tile {...props} minimal={true} />;
}
