/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, compareStrings, SortedArray } from "@itwin/core-bentley";
import type { TileTreeContentIds } from "@itwin/core-common";
import { IModelApp } from "../IModelApp";
import { IpcApp } from "../IpcApp";
import type { IModelConnection } from "../IModelConnection";
import type { IModelTileContent, Tile, TileRequest, TileTree } from "./internal";
import { IModelTile, TileRequestChannel } from "./internal";

/** Handles requests to the cloud storage tile cache, if one is configured. If a tile's content is not found in the cache, subsequent requests for the same tile will
 * use the IModelTileChannel instead.
 */
class CloudStorageCacheChannel extends TileRequestChannel {
  public override async requestContent(tile: Tile): Promise<TileRequest.Response> {
    assert(tile instanceof IModelTile);
    return IModelApp.tileAdmin.requestCachedTileContent(tile);
  }

  public override onNoContent(request: TileRequest): boolean {
    assert(request.tile instanceof IModelTile);
    request.tile.requestChannel = IModelApp.tileAdmin.channels.iModelChannels.rpc;
    ++this._statistics.totalCacheMisses;
    return true;
  }
}

/** For an [[IpcApp]], allows backend tile generation requests in progress to be canceled. */
class IModelTileChannel extends TileRequestChannel {
  private readonly _canceled = new Map<IModelConnection, Map<string, Set<string>>>();

  public override onActiveRequestCanceled(request: TileRequest): void {
    const tree = request.tile.tree;
    let entry = this._canceled.get(tree.iModel);
    if (!entry)
      this._canceled.set(tree.iModel, entry = new Map<string, Set<string>>());

    let ids = entry.get(tree.id);
    if (!ids)
      entry.set(tree.id, ids = new Set<string>());

    ids.add(request.tile.contentId);
  }

  public override processCancellations(): void {
    for (const [imodel, entries] of this._canceled) {
      const treeContentIds: TileTreeContentIds[] = [];
      for (const [treeId, tileIds] of entries) {
        const contentIds = Array.from(tileIds);
        treeContentIds.push({ treeId, contentIds });
        this._statistics.totalAbortedRequests += contentIds.length;
      }

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      IpcApp.callIpcHost("cancelTileContentRequests", imodel.getRpcProps(), treeContentIds);
    }

    this._canceled.clear();
  }

  public override onIModelClosed(imodel: IModelConnection): void {
    this._canceled.delete(imodel);
  }
}

interface CachedContent extends Omit<IModelTileContent, "graphic"> {
  contentId: string;
  hasGraphic: boolean;
}

/** If TileAdmin.Props.cacheTileMetadata is true, then this is the first channel through which we request content for an IModelTile.
 * It serves a niche purpose: a tile pre-generation agent that wants to ensure that every tile selected during interaction with the application
 * has its tile generated and cached in cloud storage. This agent might request thousands of tiles in sequence, causing a given tile to be discarded
 * and reloaded many times. To avoid pointlessly reloading tiles whose contents have already been generated, this channel caches the metadata for each tile;
 * on subsequent requests for the same tile, it produces the metadata and an empty RenderGraphic.
 */
class IModelTileMetadataCacheChannel extends TileRequestChannel {
  private readonly _cacheByIModel = new Map<IModelConnection, Map<TileTree, SortedArray<CachedContent>>>();

  public constructor() {
    super("itwinjs-imodel-metadata-cache", 100);
  }

  public override onNoContent(request: TileRequest): boolean {
    assert(request.tile instanceof IModelTile);
    const channels = IModelApp.tileAdmin.channels.iModelChannels;
    request.tile.requestChannel = channels.cloudStorage ?? channels.rpc;
    return true;
  }

  public override async requestContent(tile: Tile): Promise<TileRequest.Response> {
    assert(tile instanceof IModelTile);
    const content = this.getCachedContent(tile);
    return content ? { content } : undefined;
  }

  public getCachedContent(tile: IModelTile): IModelTileContent | undefined {
    const cached = this._cacheByIModel.get(tile.iModel)?.get(tile.tree)?.findEquivalent((x) => compareStrings(x.contentId, tile.contentId));
    if (!cached)
      return undefined;

    const content: IModelTileContent = {
      ...cached,
      graphic: cached.hasGraphic ? IModelApp.renderSystem.createGraphicList([]) : undefined,
      contentRange: cached.contentRange?.clone(),
    };

    return content;
  }

  public override onIModelClosed(imodel: IModelConnection): void {
    this._cacheByIModel.delete(imodel);
  }

  public registerChannel(channel: TileRequestChannel): void {
    channel.contentCallback = (tile, content) => this.cache(tile, content);
  }

  private cache(tile: Tile, content: IModelTileContent): void {
    assert(tile instanceof IModelTile);
    let trees = this._cacheByIModel.get(tile.iModel);
    if (!trees)
      this._cacheByIModel.set(tile.iModel, trees = new Map<TileTree, SortedArray<CachedContent>>());

    let list = trees.get(tile.tree);
    if (!list)
      trees.set(tile.tree, list = new SortedArray<CachedContent>((lhs, rhs) => compareStrings(lhs.contentId, rhs.contentId)));

    assert(undefined === list.findEquivalent((x) => compareStrings(x.contentId, tile.contentId)));
    list.insert({
      contentId: tile.contentId,
      hasGraphic: undefined !== content.graphic,
      contentRange: content.contentRange?.clone(),
      isLeaf: content.isLeaf,
      sizeMultiplier: content.sizeMultiplier,
      emptySubRangeMask: content.emptySubRangeMask,
    });
  }
}

/** TileRequestChannels used for requesting content for IModelTiles.
 * @internal
 */
export class IModelTileRequestChannels {
  private _cloudStorage?: TileRequestChannel;
  private readonly _contentCache?: IModelTileMetadataCacheChannel;
  public readonly rpc: TileRequestChannel;

  public constructor(args: {
    concurrency: number;
    usesHttp: boolean;
    cacheMetadata: boolean;
  }) {
    const channelName = "itwinjs-tile-rpc";
    this.rpc = args.usesHttp ? new TileRequestChannel(channelName, args.concurrency) : new IModelTileChannel(channelName, args.concurrency);
    if (!args.cacheMetadata)
      return;

    this._contentCache = new IModelTileMetadataCacheChannel();
    this._contentCache.registerChannel(this.rpc);
  }

  public get cloudStorage(): TileRequestChannel | undefined {
    return this._cloudStorage;
  }

  public enableCloudStorageCache(concurrency: number): TileRequestChannel {
    assert(undefined === this._cloudStorage);
    this._cloudStorage = new CloudStorageCacheChannel("itwinjs-cloud-cache", concurrency);
    this._contentCache?.registerChannel(this._cloudStorage);
    return this._cloudStorage;
  }

  public [Symbol.iterator](): Iterator<TileRequestChannel> {
    const channels = [this.rpc];
    if (this._cloudStorage)
      channels.push(this._cloudStorage);

    if (this._contentCache)
      channels.push(this._contentCache);

    return channels[Symbol.iterator]();
  }

  public setRpcConcurrency(concurrency: number): void {
    this.rpc.concurrency = concurrency;
  }

  public getChannelForTile(tile: IModelTile): TileRequestChannel {
    return tile.requestChannel || this._contentCache || this._cloudStorage || this.rpc;
  }

  /** Strictly for tests. */
  public getCachedContent(tile: IModelTile): IModelTileContent | undefined {
    return this._contentCache?.getCachedContent(tile);
  }
}
