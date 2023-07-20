/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import { assert, ByteStream } from "@itwin/core-bentley";
import { TileFormat, TileHeader } from "./TileIO";

/** Known version of the [glTF format](https://www.khronos.org/gltf/).
 * @internal
 */
export enum GltfVersions {
  Version1 = 1,
  Version2 = 2,
  CurrentVersion = Version1,
  Gltf1SceneFormat = 0,
}

/** @internal */
export enum GltfV2ChunkTypes {
  JSON = 0x4E4F534a,
  Binary = 0x004E4942,
}

/** A chunk of a glb file.
 * @internal
 */
export interface GltfChunk {
  /** Offset of the first byte of the chunk's data relative to the beginning of the glb data.
   * This excludes the 8-byte chunk header containing the length and type fields.
   */
  offset: number;
  /** The number of bytes in the chunk's data. */
  length: number;
}

/** Describes a glTF chunk's data along with its type.
 * @internal
 */
export type TypedGltfChunk = GltfChunk & { type: number };

function consumeNextChunk(stream: ByteStream): TypedGltfChunk | undefined | false {
  if (stream.isAtTheEnd)
    return undefined;

  const offset = stream.curPos + 8;

  const length = stream.readUint32();
  if (stream.isAtTheEnd)
    return undefined;

  const type = stream.readUint32();
  stream.advance(length);
  return stream.isPastTheEnd ? false : { offset, length, type };
}

/** @internal */
export class GlbHeader extends TileHeader {
  public readonly gltfLength: number = 0;
  public readonly jsonChunk: GltfChunk = { offset: 0, length: 0 };
  public readonly binaryChunk?: GltfChunk;
  public readonly additionalChunks: TypedGltfChunk[] = [];

  public get isValid(): boolean {
    return TileFormat.Gltf === this.format;
  }

  public constructor(stream: ByteStream) {
    super(stream);
    this.gltfLength = stream.readUint32();

    const jsonLength = stream.readUint32();
    const word5 = stream.readUint32();

    // Early versions of the reality data tile publisher incorrectly put version 2 into header - handle these old tiles
    // validating the chunk type.
    if (this.version === GltfVersions.Version2 && word5 === GltfVersions.Gltf1SceneFormat)
      this.version = GltfVersions.Version1;

    this.jsonChunk = { offset: stream.curPos, length: jsonLength };
    switch (this.version) {
      case GltfVersions.Version1:
        if (GltfVersions.Gltf1SceneFormat !== word5) {
          this.invalidate();
          return;
        }

        const binaryOffset = stream.curPos + jsonLength;
        this.binaryChunk = { offset: binaryOffset, length: this.gltfLength - binaryOffset };
        break;
      case GltfVersions.Version2:
        if (word5 !== GltfV2ChunkTypes.JSON) {
          this.invalidate();
          return;
        }

        stream.advance(jsonLength);
        if (stream.isPastTheEnd) {
          this.invalidate();
          return;
        }

        let chunk;
        while (chunk = consumeNextChunk(stream)) {
          switch (chunk.type) {
            case GltfV2ChunkTypes.JSON:
              // Only one JSON chunk permitted and it must be the first.
              this.invalidate();
              return;
            case GltfV2ChunkTypes.Binary:
              // At most one binary chunk permitted and it must be the second if present.
              if (this.binaryChunk || this.additionalChunks.length) {
                this.invalidate();
                return;
              }

              this.binaryChunk = { offset: chunk.offset, length: chunk.length };
              break;
            default:
              // Any other chunk type should be ignored - for use by extensions.
              this.additionalChunks.push(chunk);
              break;
          }
        }

        if (false === chunk) {
          this.invalidate();
          return;
        }

        assert(undefined === chunk);
        assert(stream.isAtTheEnd);
        break;
      default:
        this.invalidate();
        break;
    }
  }
}
