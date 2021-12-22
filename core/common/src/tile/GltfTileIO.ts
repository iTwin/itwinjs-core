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

export interface GltfChunk {
  offset: number;
  length: number;
}

type TypedGltfChunk = GltfChunk & { type: number };

function consumeNextChunk(stream: ByteStream): TypedGltfChunk | undefined | false {
  if (stream.isAtTheEnd)
    return undefined;

  const offset = stream.curPos;
  const length = stream.nextUint32;
  const type = stream.nextUint32;
  stream.advance(length);
  return stream.isPastTheEnd ? false : { offset, length, type };
}

export class GlbHeader extends TileHeader {
  public readonly gltfLength: number = 0;
  public readonly jsonChunk: GltfChunk = { offset: 0, length: 0 };
  public readonly binaryChunk?: GltfChunk;

  public get isValid(): boolean {
    return TileFormat.Gltf === this.format;
  }

  public constructor(stream: ByteStream) {
    super(stream);
    this.gltfLength = stream.nextUint32;
    if (this.gltfLength !== stream.length) {
      this.invalidate();
      return;
    }

    const jsonLength = stream.nextUint32;
    const word5 = stream.nextUint32;

    // Early versions of the reality data tile publisher incorrectly put version 2 into header - handle these old tiles
    // validating the chunk type.
    if (this.version === GltfVersions.Version2 && word5 === GltfVersions.Gltf1SceneFormat)
      this.version = GltfVersions.Version1;

    this.jsonChunk = { offset: stream.curPos, length: jsonLength }
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

        let numChunks = 1;
        let chunk;
        while (chunk = consumeNextChunk(stream)) {
          ++numChunks;
          switch (chunk.type) {
            case GltfV2ChunkTypes.JSON:
              // Only one JSON chunk permitted and it must be the first.
              this.invalidate();
              return;
            case GltfV2ChunkTypes.Binary:
              // At most one binary chunk permitted and it must be the second if present.
              if (this.binaryChunk || numChunks !== 2) {
                this.invalidate();
                return;
              }

              this.binaryChunk = { offset: chunk.offset, length: chunk.length };
              break;
            default:
              // Any other chunk type should be ignored - for use by extensions.
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

/** Header preceding glTF data.
 * @internal
 */
export class GltfHeader extends TileHeader {
  public readonly gltfLength: number;
  public readonly scenePosition: number = 0;
  public readonly sceneStrLength: number = 0;
  public readonly binaryPosition: number = 0;
  public get isValid(): boolean { return TileFormat.Gltf === this.format; }

  public constructor(stream: ByteStream) {
    super(stream);
    this.gltfLength = stream.nextUint32;
    if (this.gltfLength !== stream.length) {
      this.invalidate();
      return;
    }

    this.sceneStrLength = stream.nextUint32;
    const value5 = stream.nextUint32;

    // Early versions of the reality data tile publisher incorrectly put version 2 into header - handle these old tiles
    // validating the chunk type.
    if (this.version === GltfVersions.Version2 && value5 === GltfVersions.Gltf1SceneFormat)
      this.version = GltfVersions.Version1;

    if (this.version === GltfVersions.Version1) {
      const gltfSceneFormat = value5;
      if (GltfVersions.Gltf1SceneFormat !== gltfSceneFormat) {
        this.invalidate();
        return;
      }

      this.scenePosition = stream.curPos;
      this.binaryPosition = stream.curPos + this.sceneStrLength;
    } else if (this.version === GltfVersions.Version2) {
      const sceneChunkType = value5;
      this.scenePosition = stream.curPos;
      stream.curPos = stream.curPos + this.sceneStrLength;
      const binaryLength = stream.nextUint32;
      const binaryChunkType = stream.nextUint32;
      if (GltfV2ChunkTypes.JSON !== sceneChunkType || GltfV2ChunkTypes.Binary !== binaryChunkType || 0 === binaryLength) {
        this.invalidate();
        return;
      }

      this.binaryPosition = stream.curPos;
    } else {
      this.invalidate();
    }
  }
}
