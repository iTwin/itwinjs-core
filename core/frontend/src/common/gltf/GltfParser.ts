/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { ByteStream, JsonUtils, Logger, utf8ToString } from "@itwin/core-bentley";
import { Matrix3d, Point3d, Point4d, Transform } from "@itwin/core-geometry";
import { GlbHeader, ImageSource, TileFormat } from "@itwin/core-common";
import type { DracoLoader, DracoMesh } from "@loaders.gl/draco";
import { FrontendLoggerCategory } from "../FrontendLoggerCategory";
import { TextureImageSource } from "../render/TextureParams";
import {
  getImageSourceFormatForMimeType, imageBitmapFromImageSource, imageElementFromImageSource, tryImageElementFromUrl,
} from "../ImageUtil";
import {
  DracoMeshCompression, getGltfNodeMeshIds, GltfAccessor, GltfBuffer, GltfBufferViewProps, GltfDictionary, gltfDictionaryIterator, GltfDocument, GltfId, GltfImage, GltfMesh, GltfMeshMode, GltfMeshPrimitive, GltfNode, traverseGltfNodes,
} from "./GltfSchema";
import { Gltf } from "./GltfModel";

/** @internal */
export interface ParseGltfLogger {
  log(message: string, type: "error" | "warning" | "info"): void;
}

/** Arguments supplied to [[parseGltf]].
 * @internal
 */
export interface ParseGltfArgs {
  logger?: ParseGltfLogger;
  gltf: Uint8Array | GltfDocument;
  noCreateImageBitmap?: boolean;
  baseUrl?: string;
  isCanceled?: boolean;
  upAxis?: "y" | "z"; // default "y"
}

