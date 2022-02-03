/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import type { ByteStream} from "@itwin/core-bentley";
import { utf8ToString } from "@itwin/core-bentley";
import { TileFormat, TileHeader } from "./TileIO";

/** Header preceding tile content in [i3dm](https://github.com/AnalyticalGraphicsInc/3d-tiles/tree/master/specification/TileFormats/Instanced3DModel) format.
 * @internal
 */
export class I3dmHeader extends TileHeader {
  public readonly length: number;
  public readonly featureTableJsonPosition: number;
  public readonly featureTableJsonLength: number;
  public readonly featureTableBinaryLength: number;
  public readonly batchTableJsonLength: number;
  public readonly batchTableBinaryLength: number;
  public readonly gltfVersion: number;
  public readonly batchTableJson: any;
  public get isValid(): boolean { return TileFormat.I3dm === this.format; }

  public constructor(stream: ByteStream) {
    super(stream);
    this.length = stream.nextUint32;
    this.featureTableJsonLength = stream.nextUint32;
    this.featureTableBinaryLength = stream.nextUint32;
    this.batchTableJsonLength = stream.nextUint32;
    this.batchTableBinaryLength = stream.nextUint32;
    this.gltfVersion = stream.nextUint32;
    this.featureTableJsonPosition = stream.curPos;
    stream.advance(this.featureTableJsonLength);
    stream.advance(this.featureTableBinaryLength);
    if (0 !== this.batchTableJsonLength) {
      const batchStrData = stream.nextBytes(this.batchTableJsonLength);
      const batchStr = utf8ToString(batchStrData);
      if (batchStr) this.batchTableJson = JSON.parse(batchStr);
    }
    stream.advance(this.batchTableBinaryLength);

    if (stream.isPastTheEnd)
      this.invalidate();
  }
}
