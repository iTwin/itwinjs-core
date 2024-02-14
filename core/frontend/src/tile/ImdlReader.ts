/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { ByteStream, Id64Set, Id64String } from "@itwin/core-bentley";
import { Point3d, Transform } from "@itwin/core-geometry";
import {
  BatchType, decodeTileContentDescription, TileReadError, TileReadStatus,
} from "@itwin/core-common";
import { IModelApp } from "../IModelApp";
import { IModelConnection } from "../IModelConnection";
import { GraphicBranch } from "../render/GraphicBranch";
import { RenderGraphic } from "../render/RenderGraphic";
import { BatchOptions } from "../render/GraphicBuilder";
import { RenderSystem } from "../render/RenderSystem";
import { ImdlModel } from "../common/imdl/ImdlModel";
import { convertFeatureTable, ImdlParseError, ImdlParserOptions, ImdlTimeline, parseImdlDocument } from "../common/imdl/ParseImdlDocument";
import { decodeImdlGraphics, IModelTileContent } from "./internal";

/* eslint-disable no-restricted-syntax */

/** @internal */
export interface ImdlReaderResult extends IModelTileContent {
  readStatus: TileReadStatus;
}

/** Convert the byte array returned by [[TileAdmin.requestElementGraphics]] into a [[RenderGraphic]].
 * @param bytes The binary graphics data obtained from `requestElementGraphics`.
 * @param iModel The iModel with which the graphics are associated.
 * @param modelId The Id of the [[GeometricModelState]] with which the graphics are associated. Can be an invalid Id.
 * @param is3d True if the graphics are 3d.
 * @param options Options customizing how [Feature]($common)s within the graphic can be resymbolized; or false if you don't want to produce a batch.
 * @public
 * @extensions
 */
export async function readElementGraphics(bytes: Uint8Array, iModel: IModelConnection, modelId: Id64String, is3d: boolean, options?: BatchOptions | false): Promise<RenderGraphic | undefined> {
  const stream = ByteStream.fromUint8Array(bytes);
  const reader = ImdlReader.create({
    stream, iModel, modelId, is3d, options,
    system: IModelApp.renderSystem,
  });

  const result = await reader.read();
  return result.graphic;
}

/** Arguments supplied to [[ImdlReader.create]]
 * @internal
 */
export interface ImdlReaderCreateArgs {
  stream: ByteStream;
  iModel: IModelConnection;
  modelId: Id64String;
  is3d: boolean;
  /** If undefined, the tile's leafness will be deduced by decodeTileContentDescription. */
  isLeaf?: boolean;
  system: RenderSystem;
  type?: BatchType; // default Primary
  loadEdges?: boolean; // default true
  isCanceled?: () => boolean;
  sizeMultiplier?: number;
  options?: BatchOptions | false;
  containsTransformNodes?: boolean; // default false
  /** Supplied if the graphics in the tile are to be split up based on the nodes in the timeline. */
  timeline?: ImdlTimeline;
  modelGroups?: Id64Set[];
}

/** @internal */
export async function readImdlContent(args: ImdlReaderCreateArgs & { parseDocument?: (parseOpts: ImdlParserOptions) => Promise<ImdlModel.Document | ImdlParseError> }): Promise<ImdlReaderResult> {
  const isCanceled = args.isCanceled ?? (() => false);
  let content;
  try {
    content = decodeTileContentDescription({
      stream: args.stream,
      sizeMultiplier: args.sizeMultiplier,
      is2d: !args.is3d,
      options: IModelApp.tileAdmin,
      isVolumeClassifier: BatchType.VolumeClassifier === args.type,
      isLeaf: args.isLeaf,
    });
  } catch (e) {
    if (e instanceof TileReadError)
      return { isLeaf: true, readStatus: e.errorNumber };
    else
      throw e;
  }

  args.stream.reset();
  const parseOpts: ImdlParserOptions = {
    data: args.stream.readBytes(0, args.stream.length),
    batchModelId: args.modelId,
    is3d: args.is3d,
    maxVertexTableSize: IModelApp.renderSystem.maxTextureSize,
    omitEdges: false === args.loadEdges,
    createUntransformedRootNode: args.containsTransformNodes,
    modelGroups: args.modelGroups,
  };

  const document = args.parseDocument ? (await args.parseDocument(parseOpts)) : parseImdlDocument({ ...parseOpts, timeline: args.timeline });
  if (isCanceled())
    return { isLeaf: true, readStatus: TileReadStatus.Canceled };
  else if (typeof document === "number")
    return { isLeaf: true, readStatus: document };

  let graphic = await decodeImdlGraphics({
    system: args.system,
    iModel: args.iModel,
    document,
    isCanceled: args.isCanceled,
  });

  if (isCanceled())
    return { isLeaf: true, readStatus: TileReadStatus.Canceled };

  if (graphic && false !== args.options) {
    const featureTable = convertFeatureTable(document.featureTable, args.modelId);
    graphic = args.system.createBatch(graphic, featureTable, content.contentRange, args.options);
  }

  if (graphic && document.rtcCenter) {
    const rtcBranch = new GraphicBranch(true);
    rtcBranch.add(graphic);
    graphic = args.system.createBranch(rtcBranch, Transform.createTranslation(Point3d.fromJSON(document.rtcCenter)));
  }

  return {
    readStatus: TileReadStatus.Success,
    isLeaf: content.isLeaf,
    sizeMultiplier: content.sizeMultiplier,
    contentRange: content.contentRange.isNull ? undefined : content.contentRange,
    graphic,
    emptySubRangeMask: content.emptySubRangeMask,
  };
}

/** @internal */
export interface ImdlReader {
  read: () => Promise<ImdlReaderResult>;
}

/** @internal */
export namespace ImdlReader {
  export function create(args: ImdlReaderCreateArgs): ImdlReader {
    return {
      read: async () => readImdlContent(args),
    };
  }
}
