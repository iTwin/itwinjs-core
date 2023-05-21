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

export interface ImdlDecodeArgs {
  stream: ByteStream;
  system: RenderSystem;
  isLeaf?: boolean;
  sizeMultiplier?: number;
  options?: BatchOptions | false;
  isCanceled?: () => boolean;
}

export interface ImdlDecoder {
  decode(args: ImdlDecodeArgs): Promise<ImdlReaderResult>;
  release(): void;
}

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
        parseDocument: (parserOpts) => parser.parse(parserOpts),
      });
    },
  };
}
