/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import { ByteStream } from "@itwin/core-bentley";
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
