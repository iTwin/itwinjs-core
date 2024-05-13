/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { TileContent, TileRequest, TileRequestChannel } from "./internal";

export class IDBTileStorage {
  private _db: any;
  private _dbName: string = "IDB";

  public constructor(dbName: string) {
    this._dbName = dbName;
  }

  public async init() {

    // set up IndexedDB
    const requestDB = window.indexedDB.open(this._dbName, 1);

    requestDB.onerror = () => {
      console.log("Error opening up DB");
    };

    requestDB.onsuccess = (event) => {
      console.log("Success opening up DB");

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

  public async requestContent(uniqueId: string): Promise<TileRequest.Response> {

    // if _db is not opened, return
    if (!this._db) {
      return undefined;
    }

    console.log("REQUESTING TILE FROM CACHE MX-IDB");
    const getTransaction = await this._db.transaction("tile-cache", "readonly");
    const storedResponse = await getTransaction.objectStore("tile-cache").get(uniqueId);

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
          await this.deleteContent(uniqueId);
        }

      } else {
        console.log("NO MATCHING RESULT FOUND");
      }
      return undefined;
    };
    return undefined;
  }

  public async deleteContent(uniqueId: string) {
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

  public async addContent(uniqueId: string, tileContent: ArrayBuffer | TileContent) {
    const addTransaction = await this._db.transaction("tile-cache", "readwrite");
    const objectStore = await addTransaction.objectStore("tile-cache");

    const tileData = {
      uniqueId,
      tileContent,
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
}

export class IDBTileRequestChannel extends TileRequestChannel {
  private _tileStorage: IDBTileStorage;

  public constructor(channelName: string, cacheConcurrency: number, dbName: string) {

    console.log("CREATING CHANNEL: ", channelName);
    super(channelName, cacheConcurrency);

    this._tileStorage = new IDBTileStorage(dbName);
  }

  public get tileStorage(): IDBTileStorage {
    return this._tileStorage;
  }
}
