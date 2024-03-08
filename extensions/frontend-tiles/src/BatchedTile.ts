/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, BeTimePoint, ByteStream, Logger } from "@itwin/core-bentley";
import { Transform } from "@itwin/core-geometry";
import { ColorDef, Tileset3dSchema } from "@itwin/core-common";
import {
  GraphicBranch, GraphicBuilder, IModelApp, RealityTileLoader, RenderSystem, Tile, TileBoundingBoxes, TileContent,
  TileDrawArgs, TileParams, TileRequest, TileRequestChannel, TileTreeLoadStatus, TileUser, TileVisibility, Viewport,
} from "@itwin/core-frontend";
import { loggerCategory } from "./LoggerCategory";
import { BatchedTileTree } from "./BatchedTileTree";
import { frontendTilesOptions } from "./FrontendTiles";

/** @internal */
export interface BatchedTileParams extends TileParams {
  childrenProps: Tileset3dSchema.Tile[] | undefined;
  /** See BatchedTile.transformToRoot. */
  transformToRoot: Transform | undefined;
}

let channel: TileRequestChannel | undefined;

/** @internal */
export class BatchedTile extends Tile {
  private readonly _childrenProps?: Tileset3dSchema.Tile[];
  private readonly _unskippable: boolean;
  /** Transform from the tile's local coordinate system to that of the tileset. */
  public readonly transformToRoot?: Transform;

  private _db: any;

  public get batchedTree(): BatchedTileTree {
    return this.tree as BatchedTileTree;
  }

  public constructor(params: BatchedTileParams, tree: BatchedTileTree) {
    super(params, tree);

    // The root tile never has content, so it doesn't count toward max levels to skip.
    this._unskippable = 0 === (this.depth % frontendTilesOptions.maxLevelsToSkip);

    if (params.childrenProps?.length)
      this._childrenProps = params.childrenProps;

    if (!this.contentId) {
      this.setIsReady();
      // mark "undisplayable"
      this._maximumSize = 0;
    }

    if (!params.transformToRoot)
      return;

    this.transformToRoot = params.transformToRoot;
    this.boundingSphere.transformBy(this.transformToRoot, this.boundingSphere);
    this.transformToRoot.multiplyRange(this.range, this.range);
    if (this._contentRange)
      this.transformToRoot.multiplyRange(this._contentRange, this._contentRange);
  }

  private get _batchedChildren(): BatchedTile[] | undefined {
    return this.children as BatchedTile[] | undefined;
  }

  public override computeLoadPriority(viewports: Iterable<Viewport>, _users: Iterable<TileUser>): number {
    // Prioritize tiles closer to camera and center of attention (zoom point or screen center).
    return RealityTileLoader.computeTileLocationPriority(this, viewports, this.tree.iModelTransform);
  }

  public selectTiles(selected: Set<BatchedTile>, args: TileDrawArgs, closestDisplayableAncestor: BatchedTile | undefined): void {
    const vis = this.computeVisibility(args);
    if (TileVisibility.OutsideFrustum === vis)
      return;

    if (this._unskippable) {
      // Prevent this tile's content from being unloaded due to memory pressure.
      args.touchedTiles.add(this);
      args.markUsed(this);
    }

    closestDisplayableAncestor = this.hasGraphics ? this : closestDisplayableAncestor;
    if (TileVisibility.TooCoarse === vis && (this.isReady || !this._unskippable)) {
      args.markUsed(this);
      args.markReady(this);
      const childrenLoadStatus = this.loadChildren();
      if (TileTreeLoadStatus.Loading === childrenLoadStatus)
        args.markChildrenLoading();

      const children = this._batchedChildren;
      if (children) {
        for (const child of children)
          child.selectTiles(selected, args, closestDisplayableAncestor);

        return;
      }
    }

    // We want to display this tile. Request its content if not already loaded.
    if ((TileVisibility.Visible === vis || this._unskippable) && !this.isReady)
      args.insertMissing(this);

    if (closestDisplayableAncestor)
      selected.add(closestDisplayableAncestor);
  }

  protected override _loadChildren(resolve: (children: Tile[] | undefined) => void, reject: (error: Error) => void): void {
    let children: BatchedTile[] | undefined;
    if (this._childrenProps) {
      try {
        for (const childProps of this._childrenProps) {
          const params = this.batchedTree.reader.readTileParams(childProps, this);
          const child = new BatchedTile(params, this.batchedTree);
          children = children ?? [];
          children.push(child);
        }
      } catch (err) {
        Logger.logException(loggerCategory, err);
        children = undefined;
        if (err instanceof Error)
          reject(err);
      }
    }

    resolve(children);
  }

  public override get channel(): TileRequestChannel {
    if (!channel) {
      channel = new TileRequestChannel("itwinjs-batched-models", 20);
      IModelApp.tileAdmin.channels.add(channel);

      // Create indexedDB cache
      const requestDB = window.indexedDB.open("MX-IDB", 1);

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

      // This will get called when a new version of the db is needed - including going from no database to first version
      // So this is how we set up the specifics of the db structure
      requestDB.onupgradeneeded = (event) => {
        console.log("ON UPGRADE NEEDED");
        const target: any = event.target;

        if (target)
          this._db = target.result;

        const initialObjectStore = this._db.createObjectStore("tile-cache", { keyPath: "uniqueId" });
        console.log("CREATE INITIAL DATA STORE MX-IDB");

        initialObjectStore.createIndex("content", "content", {unique: false});

      };
    }

    return channel;
  }

  private async requestContentFromIDB(uniqueId: string): Promise<ArrayBuffer | undefined> {
    console.log("REQUESTING TILE FROM CACHE MX-IDB");
    const getTransaction = await this._db.transaction("tile-cache", "readonly");
    const storedResponse = await getTransaction.objectStore("tile-cache").get(this.contentId + this.tree.id);

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

          const content = storedResponse.result.content;

          console.log("RETURNING THE FOLLOWING TILE");
          console.log(content);
          return content;

        } else { // otherwise delete the tile and go on with the normal request route
          await this.deleteTileFromIDB(this.contentId + this.tree.id);
        }

      } else {
        console.log("NO MATCHING RESULT FOUND");
      }
      return undefined;
    };
    return undefined;
  }

  private async deleteTileFromIDB(uniqueId: string) {
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

  private async addTileToIDB(response: ArrayBuffer) {

    const addTransaction = await this._db.transaction("tile-cache", "readwrite");
    const objectStore = await addTransaction.objectStore("tile-cache");

    const tileData = {
      // create a unique id by concatenating tile content id and tree id
      uniqueId: this.contentId + this.tree.id,
      content: response,
    };

    console.log("ADDING THIS TILE TO MX-IDB");
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

  public override async requestContent(_isCanceled: () => boolean): Promise<TileRequest.Response> {

    // First check IDB to see if we can find the til without fetching it
    const cachedContent = await this.requestContentFromIDB(this.contentId + this.tree.id);

    if (cachedContent) {
      console.log("Cached Content being returned");
      return cachedContent;
    }

    const url = new URL(this.contentId, this.batchedTree.reader.baseUrl);
    url.search = this.batchedTree.reader.baseUrl.search;
    const response = await fetch(url.toString());
    await this.addTileToIDB(await response.arrayBuffer());
    return response.arrayBuffer();
  }

  public override async readContent(data: TileRequest.ResponseData, system: RenderSystem, isCanceled?: () => boolean): Promise<TileContent> {
    assert(data instanceof Uint8Array);
    if (!(data instanceof Uint8Array))
      return { };

    try {
      const modelGroups = this.batchedTree.modelGroups;

      const content = await this.batchedTree.decoder.decode({
        stream: ByteStream.fromUint8Array(data),
        options: { tileId: this.contentId },
        system,
        isCanceled,
        isLeaf: this.isLeaf,
        // Don't waste time attempting to split based on model groupings if all models are in the same group.
        modelGroups: modelGroups && modelGroups.length > 1 ? modelGroups : undefined,
      });

      if (this.transformToRoot) {
        if (content.graphic) {
          const branch = new GraphicBranch(true);
          branch.add(content.graphic);
          content.graphic = system.createBranch(branch, this.transformToRoot);
        }

        if (content.contentRange)
          content.contentRange = this.transformToRoot.multiplyRange(content.contentRange);
      }

      return content;
    } catch {
      return { isLeaf: true };
    }
  }

  protected override addRangeGraphic(builder: GraphicBuilder, type: TileBoundingBoxes): void {
    if (TileBoundingBoxes.ChildVolumes !== type) {
      super.addRangeGraphic(builder, type);
      return;
    }

    builder.setSymbology(ColorDef.green, ColorDef.green, 2);
    builder.addRangeBox(this.range);

    this.loadChildren();
    const children = this.children;
    if (!children)
      return;

    builder.setSymbology(ColorDef.blue, ColorDef.blue.withTransparency(0xdf), 1);
    for (const child of children) {
      const range = child.range;
      builder.addRangeBox(range);
      builder.addRangeBox(range, true);
    }
  }

  public prune(olderThan: BeTimePoint): void {
    const children = this._batchedChildren;
    if (!children)
      return;

    if (this.usageMarker.isExpired(olderThan)) {
      this.disposeChildren();
    } else {
      for (const child of children)
        child.prune(olderThan);
    }
  }
}
