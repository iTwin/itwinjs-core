/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tile */
import { TileIO } from "./TileIO";

/**
 * Provides facilities for deserializing Composite (cmpt) tiles.
 * @hidden
 */
export namespace CompositeTileIO {
  export class Header extends TileIO.Header {
    public readonly length: number;
    public readonly tileCount: number;
    public readonly tilePosition: number;

    public get isValid(): boolean { return TileIO.Format.Cmpt === this.format; }

    public constructor(stream: TileIO.StreamBuffer) {
      super(stream);
      this.length = stream.nextUint32;
      this.tileCount = stream.nextUint32;
      this.tilePosition = stream.curPos;

      if (stream.isPastTheEnd)
        this.invalidate();
    }
  }
}
