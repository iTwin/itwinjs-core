/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import * as React from "react";
import type { TileProps } from "./Tile";
import { Tile } from "./Tile";

/** Minimal [[Tile]] component
 * @beta
 * @deprecated Use Tile in itwinui-react instead
 */
export function MinimalTile(props: TileProps) { // eslint-disable-line deprecation/deprecation
  return <Tile {...props} minimal={true} />;  // eslint-disable-line deprecation/deprecation
}
