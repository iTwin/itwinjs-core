/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, compareStrings, SortedArray } from "@itwin/core-bentley";
import { TileTreeContentIds } from "@itwin/core-common";
import { IModelApp } from "../IModelApp";
import { IpcApp } from "../IpcApp";
import { IModelConnection } from "../IModelConnection";
import { IModelTile, IModelTileContent, Tile, TileRequest, TileRequestChannel, TileTree } from "./internal";

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

class LocalStorageCacheChannel extends TileRequestChannel {

  private _db: any;

  public constructor(cacheConcurrency: number) {
    console.log("CREATING LOCALSTORAGECACHECHANNEL");
    super("itwinjs-local-cache", cacheConcurrency);

    // Now set up IndexedDB
    const requestDB = window.indexedDB.open("IDB", 1);

    requestDB.onerror = () => {
      console.log("Error opening up IDBL");
    };

    requestDB.onsuccess = (event) => {
      console.log("Success opening up IDB");

      const target: any = event.target;
      if (target) {
        this._db = target.result;
        console.log(this._db);
      }
    };

    // This will get called when a new version is needed - including going from no database to first version
    // So this is how we set up the specifics of the db structure
    requestDB.onupgradeneeded = (event) => {
      console.log("ON UPGRADE NEEDED");
      const target: any = event.target;

      if (target)
        this._db = target.result;

      const initialObjectStore = this._db.createObjectStore("tile-cache", { keyPath: "uniqueId" });
      console.log("create initial data store");

      initialObjectStore.createIndex("hasGraphic", "hasGraphic", {unique: false});
      initialObjectStore.createIndex("contentRange", "contentRange", {unique: false});
      initialObjectStore.createIndex("isLeaf", "isLeaf", {unique: false});
      initialObjectStore.createIndex("sizeMultiplier", "sizeMultiplier", {unique: false});
      initialObjectStore.createIndex("emptySubRangeMask", "emptySubRangeMask", {unique: false});
      initialObjectStore.createIndex("timeOfStorage", "timeOfStorage", {unique: false});

    };
  }

  public async requestLocalCachedTileContent(tile: Tile): Promise<TileRequest.Response> {
    console.log("REQUESTING TILE FROM CACHE");
    const getTransaction = await this._db.transaction("tile-cache", "readonly");
    const storedResponse = await getTransaction.objectStore("tile-cache").get(tile.contentId + tile.tree.id);

    // If we found a result
    storedResponse.onsuccess = async () => {
      console.log("STORED RESPONSE SUCCESS");
      if (storedResponse.result !== undefined) {
        console.log("THERES A RESULT");
        // We want to know when the result was stored, and how long it's been since that point
        const timeSince = Date.now() - storedResponse.result.timeOfStorage;
        console.log("TIME SINCE STORAGE: ", timeSince / 1000, " secs" );

        // If this time since is within our time limit (for now, two minutes), pass the stored response along
        if ( timeSince <= 120000) {
          console.log("STORED RESPONSE STILL VALID");
          const result = storedResponse.result;

          const cachedContent: CachedContent = {
            contentId: tile.contentId,
            hasGraphic: result.hasGraphic,
            contentRange: result.contentRange,
            isLeaf: result.isLeaf,
            sizeMultiplier: result.sizeMultiplier,
            emptySubRangeMask: result.emptySubRangeMask,
          };

          const returnContent: IModelTileContent = {
            ...cachedContent,
            graphic: cachedContent.hasGraphic ? IModelApp.renderSystem.createGraphicList([]) : undefined,
            contentRange: cachedContent.contentRange,
          };

          console.log("RETURNING THE FOLLOWING TILE");
          console.log(returnContent);
          return returnContent;

        } else { // otherwise delete the tile and go on with the normal request route
          await this.doDeleteTransaction(tile.contentId + tile.tree.id);
        }

      } else {
        console.log("NO MATCHING RESULT FOUND");
      }
      return undefined;
    };
    return undefined;
  }

  public async doDeleteTransaction(uniqueId: string) {
    const deleteTransaction = await this._db.transaction("tile-cache", "readwrite");
    const requestDelete = await deleteTransaction.objectStore("tile-cache").delete(uniqueId);

    requestDelete.onsuccess = () => {
      console.log("EXPIRED RESPONSE DELETED.");
    };

    deleteTransaction.onsuccess = () => {
      console.log("DELETE TRANSACTION SUCCESS");
    };

    deleteTransaction.oncomplete = async () => {
      console.log("DELETE TRANSACTION COMPLETED");
    };
  }

  public async doAddTransaction(tile: Tile, content: IModelTileContent) {

    // to do this we probably need to re-request the tile, get the data, and then store it.
    // need to somehow not request the same tile multiple times.
    const addTransaction = await this._db.transaction("tile-cache", "readwrite");
    const objectStore = await addTransaction.objectStore("tile-cache");

    const tileData = {
      // create a unique id by concatenating tile content id and tree id
      uniqueId: tile.contentId + tile.tree.id,
      hasGraphic: undefined !== content.graphic,
      contentRange: content.contentRange?.clone(),
      isLeaf: content.isLeaf,
      sizeMultiplier: content.sizeMultiplier,
      emptySubRangeMask: content.emptySubRangeMask,
      timeOfStorage: Date.now(),
    };

    console.log("ADDING THIS TILE TO THE DB");
    console.log(tileData);

    const requestAdd = await objectStore.add(tileData);
    requestAdd.onsuccess = () => {
      console.log("ADD REQUEST SUCCESS");
    };

    addTransaction.onsuccess = () => {
      console.log("WRITE TRANSACTION SUCCESS");
    };

    addTransaction.oncomplete = () => {
      console.log("WRITE TRANSACTION COMPLETE");
    };
  }

  public override async requestContent(tile: Tile): Promise<TileRequest.Response> {
    assert(tile instanceof IModelTile);
    return this.requestLocalCachedTileContent(tile);
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
      IpcApp.appFunctionIpc.cancelTileContentRequests(imodel.getRpcProps(), treeContentIds);
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

    // request.tile.requestChannel = channels.cloudStorage ?? channels.rpc;
    // changing this for temporary testing purposes, for now skip cloud and go to local
    // Eventually we will need to decide the order to request, local -> cloud -> rpc?
    request.tile.requestChannel = channels.localStorage ?? channels.rpc;
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
    channel.contentCallback = async (tile, content) => this.cache(tile, content, channel);
  }

  private async cache(tile: Tile, content: IModelTileContent, channel: TileRequestChannel): Promise<void> {
    if (channel.name === "itwinjs-tile-rpc") {
      return;
    }
    if (channel instanceof LocalStorageCacheChannel) {
      await channel.doAddTransaction(tile,content);
      return;
    }

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
  private _cloudStorage: TileRequestChannel;
  private _localStorage: LocalStorageCacheChannel;
  private readonly _contentCache?: IModelTileMetadataCacheChannel;
  public readonly rpc: TileRequestChannel;

  public constructor(args: {
    concurrency: number;
    usesHttp: boolean;
    cacheMetadata: boolean;
    cacheConcurrency: number;
  }) {
    const channelName = "itwinjs-tile-rpc";
    this.rpc = args.usesHttp ? new TileRequestChannel(channelName, args.concurrency) : new IModelTileChannel(channelName, args.concurrency);

    // There's almost certainly a better way to do this, but for now, if the rpc channel succesfully requests a tile, cache it in localStorage.
    this.rpc.contentCallback = async (tile, content) => this._localStorage.doAddTransaction(tile,content);
    if (args.cacheMetadata) {
      this._contentCache = new IModelTileMetadataCacheChannel();
      this._contentCache.registerChannel(this.rpc);
    }

    this._cloudStorage = new CloudStorageCacheChannel("itwinjs-cloud-cache", args.cacheConcurrency);
    this._localStorage = new LocalStorageCacheChannel(args.cacheConcurrency);
    this._contentCache?.registerChannel(this._cloudStorage);
    this._contentCache?.registerChannel(this._localStorage);
  }

  public get cloudStorage(): TileRequestChannel {
    return this._cloudStorage;
  }

  public get localStorage(): TileRequestChannel {
    return this._localStorage;
  }

  public [Symbol.iterator](): Iterator<TileRequestChannel> {
    const channels = [this.rpc];
    if (this._localStorage)
      channels.push(this._localStorage);

    else if (this._cloudStorage)
      channels.push(this._cloudStorage);

    if (this._contentCache)
      channels.push(this._contentCache);

    return channels[Symbol.iterator]();
  }

  public setRpcConcurrency(concurrency: number): void {
    this.rpc.concurrency = concurrency;
  }

  public getChannelForTile(tile: IModelTile): TileRequestChannel {
    return tile.requestChannel || this._contentCache || this._localStorage || this._cloudStorage || this.rpc;
  }

  /** Strictly for tests. */
  public getCachedContent(tile: IModelTile): IModelTileContent | undefined {
    return this._contentCache?.getCachedContent(tile);
  }
}
