/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import type { ByteStream } from "@itwin/core-bentley";
import { TileFormat, TileHeader } from "./TileIO";

/** Header preceding tile content in [composite](https://github.com/AnalyticalGraphicsInc/3d-tiles/tree/master/specification/TileFormats/Composite) format, containing any number of tiles in other standard 3D tile formats.
 * @internal
 */
export class CompositeTileHeader extends TileHeader {
  public readonly length: number;
  public readonly tileCount: number;
  public readonly tilePosition: number;

  public get isValid(): boolean { return TileFormat.Cmpt === this.format; }

  public constructor(stream: ByteStream) {
    super(stream);
    this.length = stream.nextUint32;
    this.tileCount = stream.nextUint32;
    this.tilePosition = stream.curPos;

    if (stream.isPastTheEnd)
      this.invalidate();
  }
}
