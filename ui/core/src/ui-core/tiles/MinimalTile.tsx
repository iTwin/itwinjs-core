/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tiles */

import * as React from "react";
import { Tile, TileProps } from "./Tile";

/** @alpha */
// tslint:disable-next-line:variable-name
export const MinimalTile: React.FunctionComponent<TileProps> = (props: TileProps) => {
  return <Tile {...props} minimal={true} />;
};
