/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import type { ByteStream, Id64String } from "@itwin/core-bentley";
import { BatchType } from "@itwin/core-common";
import type { IModelConnection } from "../IModelConnection";
import { BatchOptions } from "../render/GraphicBuilder";
import { RenderSystem } from "../render/RenderSystem";
import type { ImdlTimeline } from "../common/imdl/ParseImdlDocument";
import { acquireImdlParser, ImdlReaderResult, readImdlContent } from "./internal";

/** Arguments supplied to [[ImdlDecoder.decode]].
 * @internal
 */
export interface ImdlDecodeArgs {
  stream: ByteStream;
  system: RenderSystem;
  isLeaf?: boolean;
  sizeMultiplier?: number;
  options?: BatchOptions | false;
  isCanceled?: () => boolean;
}

/** An object that can decode graphics in iMdl format.
 * @note decoders are reference-counted. When you are finished using one, call [[release]].
 * @see [[acquireImdlDecoder]] to acquire a decoder.
 * @internal
 */
export interface ImdlDecoder {
  decode(args: ImdlDecodeArgs): Promise<ImdlReaderResult>;
  release(): void;
}

/** Arguments supplied to [[acquireImdlDecoder]].
 * @internal
 */
export interface AcquireImdlDecoderArgs {
  iModel: IModelConnection;
  batchModelId: Id64String;
  is3d: boolean;
  type?: BatchType;
  omitEdges?: boolean;
  containsTransformNodes?: boolean;
  timeline?: ImdlTimeline;
  noWorker?: boolean;
}

/** Acquire shared ownership of an [[ImdlDecoder]].
 * Decoders are reference-counted, because they make use of reference-counted [[ImdlParser]]s internally.
 * The caller of this function increments the reference count of the decoder and is responsible
 * for decrementing it by calling [[ImdlDecoder.release]] when it is no longer needed. Typically, a decoder's lifetime is tied to the
 * lifetime of some [IDisposable]($bentley) object like a [[TileTree]] - acquired in the constructor, and released in the `dispose` method.
 * @internal
 */
export function acquireImdlDecoder(args: AcquireImdlDecoderArgs): ImdlDecoder {
  const parser = acquireImdlParser(args);
  return {
    release: () => parser.release(),
    decode: async (decodeArgs) => {
      return readImdlContent({
        ...args,
        ...decodeArgs,
        modelId: args.batchModelId,
        loadEdges: !args.omitEdges,
        parseDocument: async (parserOpts) => parser.parse(parserOpts),
      });
    },
  };
}
