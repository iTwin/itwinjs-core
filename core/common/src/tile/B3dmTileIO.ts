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

/** Header preceding tile content in [b3dm](https://github.com/AnalyticalGraphicsInc/3d-tiles/tree/master/specification/TileFormats/Batched3DModel) format.
 * @internal
 */
export class B3dmHeader extends TileHeader {
  public readonly length: number;
  public readonly featureTableJsonLength: number;
  public readonly featureTableBinaryLength: number;
  public readonly batchTableJsonLength: number;
  public readonly batchTableBinaryLength: number;
  public readonly featureTableJson: any;
  public readonly batchTableJson: any;
  public get isValid(): boolean { return TileFormat.B3dm === this.format; }

  public constructor(stream: ByteStream) {
    super(stream);
    this.length = stream.nextUint32;
    this.featureTableJsonLength = stream.nextUint32;
    this.featureTableBinaryLength = stream.nextUint32;
    this.batchTableJsonLength = stream.nextUint32;
    this.batchTableBinaryLength = stream.nextUint32;

    // Keep this legacy check in for now since a lot of tilesets are still using the old header.
    // Legacy header #1: [batchLength] [batchTableByteLength]
    // Legacy header #2: [batchTableJsonByteLength] [batchTableBinaryByteLength] [batchLength]
    // Current header: [featureTableJsonByteLength] [featureTableBinaryByteLength] [batchTableJsonByteLength] [batchTableBinaryByteLength]
    // If the header is in the first legacy format 'batchTableJsonByteLength' will be the start of the JSON string (a quotation mark) or the glTF magic.
    // Accordingly its first byte will be either 0x22 or 0x67, and so the minimum uint32 expected is 0x22000000 = 570425344 = 570MB. It is unlikely that the feature table Json will exceed this length.
    // The check for the second legacy format is similar, except it checks 'batchTableBinaryByteLength' instead
    if (this.batchTableJsonLength >= 570425344) {
      // First legacy check
      stream.curPos = 20;
      this.batchTableJsonLength = this.featureTableBinaryLength;
      this.batchTableBinaryLength = 0;
      this.featureTableJsonLength = 0;
      this.featureTableBinaryLength = 0;
    } else if (this.batchTableBinaryLength >= 570425344) {
      // Second legacy check
      stream.curPos = 24;
      this.batchTableJsonLength = this.featureTableJsonLength;
      this.batchTableBinaryLength = this.featureTableBinaryLength;
      this.featureTableJsonLength = 0;
      this.featureTableBinaryLength = 0;
    }

    if (0 !== this.featureTableJsonLength) {
      const sceneStrData = stream.nextBytes(this.featureTableJsonLength);
      const sceneStr = utf8ToString(sceneStrData);
      if (sceneStr)
        this.featureTableJson = JSON.parse(sceneStr);
    }

    stream.advance(this.featureTableBinaryLength);
    if (0 !== this.batchTableJsonLength) {
      const batchStrData = stream.nextBytes(this.batchTableJsonLength);
      const batchStr = utf8ToString(batchStrData);
      if (batchStr)
        this.batchTableJson = JSON.parse(batchStr);
    }

    stream.advance(this.batchTableBinaryLength);

    if (stream.isPastTheEnd)
      this.invalidate();
  }
}
