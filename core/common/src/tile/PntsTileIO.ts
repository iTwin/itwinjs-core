/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import { ByteStream } from "@itwin/core-bentley";
import { TileFormat, TileHeader } from "./TileIO";

/** Header preceding tile content in [pnts](https://github.com/AnalyticalGraphicsInc/3d-tiles/tree/master/specification/TileFormats/PointCloud) format.
 * @internal
 */
export class PntsHeader extends TileHeader {
  public readonly length: number;
  public readonly featureTableJsonLength: number;
  public readonly featureTableBinaryLength: number;
  public readonly batchTableJsonLength: number;
  public readonly batchTableBinaryLength: number;
  public get isValid(): boolean { return TileFormat.Pnts === this.format; }

  public constructor(stream: ByteStream) {
    super(stream);
    this.length = stream.nextUint32;
    this.featureTableJsonLength = stream.nextUint32;
    this.featureTableBinaryLength = stream.nextUint32;
    this.batchTableJsonLength = stream.nextUint32;
    this.batchTableBinaryLength = stream.nextUint32;
  }
}
