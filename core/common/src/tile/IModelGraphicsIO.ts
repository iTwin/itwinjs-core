/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import { ByteStream, Id64String } from "@bentley/bentleyjs-core";
import { TransformProps } from "@bentley/geometry-core";
import { ContentFlags, TreeFlags } from "./TileMetadata";
import { TileFormat, TileHeader } from "./TileIO";


/** Wire format describing a request to produce graphics in [[TileFormat.IModelGraphics]] format for a single element.
 * @internal
 */
export interface IModelGraphicsRequestProps {
  /** Uniquely identifies this request among all requests for a given [[IModel]]. */
  readonly id: string;
  /** The element for which graphics are requested. */
  readonly elementId: Id64String;
  /** Log10 of the chord tolerance with which to stroke the element's geometry. e.g., for a chord tolerance of 0.01 (10^-2) meters, supply -2. */
  readonly toleranceLog10: number;
  /** The major version of the [[TileFormat.IModelGraphics]] format to use when producing the iMdl representation of the element's geometry. */
  readonly formatVersion: number;
  /** Optional flags. [[TreeFlags.UseProjectExtents]] has no effect. [[TreeFlags.EnforceDisplayPriority]] is not yet implemented. */
  readonly treeFlags?: TreeFlags;
  /** Optional flags. [[ContentFlags.ImprovedElision]] has no effect. */
  readonly contentFlags?: ContentFlags;
  /** Transform from element graphics to world coordinates. Defaults to identity. */
  readonly location?: TransformProps;
  /** If true, surface edges will be omitted from the graphics. */
  readonly omitEdges?: boolean;
}

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
