/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import { ByteStream } from "@bentley/bentleyjs-core";
import { TileFormat, TileHeader } from "./TileIO";

/** Binary header preceding tile data in [[TileFormat.IModelGraphics]] format.
 * The binary data consists of a JSON string followed by tile data in [[TileFormat.IModel]] format.
 * @internal
 */
export class IModelGraphicsHeader extends TileHeader {
  /** Absolute byte position of the json section. */
  public readonly jsonPosition: number;
  /** Length of the json section, excluding any appended padding bytes. */
  public readonly jsonLength: number;
  /** Absolute byte position of the binary tile data. */
  public readonly binaryPosition: number;

  /** Deserialize a header from the binary data at the stream's current position.
   * If the binary data does not contain a valid header, the header will be marked 'invalid'.
   */
  public constructor(stream: ByteStream) {
    super(stream);
    this.jsonPosition = stream.nextUint32;
    this.jsonLength = stream.nextUint32;
    this.binaryPosition = stream.nextUint32;

    if (stream.isPastTheEnd)
      this.invalidate;
  }

  public get isValid(): boolean {
    return TileFormat.IModelGraphics === this.version;
  }
}
