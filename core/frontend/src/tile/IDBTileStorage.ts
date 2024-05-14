/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

interface IndexedDBCache {
  fetch(url: string, callback: (url: string) => Promise<Response>): Promise<ArrayBuffer>;
}

export class IndexedDBCachePassThrough implements IndexedDBCache {
  public async fetch(url: string, callback: (url: string) => Promise<Response>): Promise<ArrayBuffer> {
    const response = await callback(url);
    return response.arrayBuffer();
  }
}

export class IndexedDBCacheManager implements IndexedDBCache{
  private _db: any;
  private _dbName: string = "IDB";
  private _expirationTime?: number;

  public constructor(dbName: string, expirationTime?: number) {
    this._dbName = dbName;
    if (expirationTime) {
      this._expirationTime = expirationTime;
    }
  }

  private async open() {

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

      const initialObjectStore = this._db.createObjectStore("cache", { keyPath: "uniqueId" });
      console.log("create initial data store");

      initialObjectStore.createIndex("content", "content", {unique: false});
      initialObjectStore.createIndex("timeOfStorage", "timeOfStorage", {unique: false});
    };
  }

  private async close() {
    await this._db.close();
  }

  private async searchCache(uniqueId: string): Promise<ArrayBuffer | undefined> {

    await this.open();

    console.log("Searching for content with this id:");
    console.log(uniqueId);
    const getTransaction = await this._db.transaction("cache", "readonly");
    const storedResponse = await getTransaction.objectStore("cache").get(uniqueId);

    // this is successful if the db was successfully searched - not only if a match was found
    storedResponse.onsuccess = async () => {

      if (storedResponse.result !== undefined) {
        console.log("Stored Response found.");

        // if the content has an expiration time
        if (this._expirationTime) {
          // We want to know when the result was stored, and how long it's been since that point
          const timeSince = Date.now() - storedResponse.result.timeOfStorage;
          console.log("Time Since Storage: ", timeSince / 1000, " secs" );

          // If it's been greater than our time limit, delete it and return undefined.
          if (timeSince > this._expirationTime) {
            console.log("Stored Response Expired, Deleting content");
            await this.deleteContent(uniqueId);
            return undefined;
          }
        }
        const content = storedResponse.result.content;
        console.log("Returning the following content: ");
        console.log(content);
        await this.close();
        return content;

      } else {
        console.log("No matching results found in db");
      }
      await this.close();
      return undefined;
    };
    return undefined;
  }

  private async deleteContent(uniqueId: string) {
    const deleteTransaction = await this._db.transaction("cache", "readwrite");
    const requestDelete = await deleteTransaction.objectStore("cache").delete(uniqueId);

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

  private async addContent(uniqueId: string, content: ArrayBuffer) {
    await this.open();
    const addTransaction = await this._db.transaction("cache", "readwrite");
    const objectStore = await addTransaction.objectStore("cache");

    const data = {
      uniqueId,
      content,
      timeOfStorage: Date.now(),
    };

    console.log("ADDING THIS CONTENT TO THE DB");
    console.log(data);

    const requestAdd = await objectStore.add(data);
    requestAdd.onsuccess = () => {
      console.log("ADD REQUEST SUCCESS");
    };

    addTransaction.onsuccess = () => {
      console.log("WRITE TRANSACTION SUCCESS");
    };

    addTransaction.oncomplete = async () => {
      console.log("WRITE TRANSACTION COMPLETE");
      await this.close();
    };
  }

  public async fetch(url: string, callback: (url: string) => Promise<Response>): Promise<ArrayBuffer> {
    let response: any;
    response = await this.searchCache(url);

    // If nothing was found in the db
    if (response === undefined) {

      // fetch normally, then add that content to the db
      response = await callback(url);
      await this.addContent(url, response.arrayBuffer());
    }

    return response.arrayBuffer();
  }
}
