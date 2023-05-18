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
import type { ImdlTimeline } from "../imdl/ImdlParser";
import { ImdlReader, ImdlReaderResult } from "./internal";

export interface ImdlDecodeArgs {
  stream: ByteStream;
  isLeaf?: boolean;
  sizeMultiplier?: number;
  options?: BatchOptions | false;
}

export interface ImdlDecoder {
  decode(args: ImdlDecodeArgs): Promise<ImdlReaderResult>;
  release(): void;
}

export interface AcquireImdlDecoderArgs {
  iModel: IModelConnection;
  batchModelId: Id64String;
  is3d: boolean;
  system: RenderSystem;
  type?: BatchType;
  omitEdges?: boolean;
  isCanceled?: () => boolean;
  containsTransformNodes?: boolean;
  timeline?: ImdlTimeline;
}

export function acquireImdlDecoder(args: AcquireImdlDecoderArgs): ImdlDecoder {
  return {
    release: () => undefined,
    decode: async (decodeArgs) => {
      const reader = ImdlReader.create({
        ...args,
        ...decodeArgs,
        modelId: args.batchModelId,
        loadEdges: !args.omitEdges,
      });

      return reader.read();
    },
  };
}
