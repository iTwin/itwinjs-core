/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Logger } from "@itwin/core-bentley";
const loggerCategory = "IndexedDBCache";

/** @internal */
export interface LocalCache {
  fetch(url: string, callback: (uniqueId: string) => Promise<Response>, callBackUrl?: string): Promise<ArrayBuffer>;
}

/** @internal */
export class PassThroughCache implements LocalCache {
  public async fetch(uniqueId: string, callback: (url: string) => Promise<Response>, callBackUrl?: string): Promise<ArrayBuffer> {
    if (callBackUrl) {
      return (await callback(callBackUrl)).arrayBuffer();
    }
    return (await callback(uniqueId)).arrayBuffer();
  }
}

/** @internal */
export class IndexedDBCache implements LocalCache{
  private _db: any;
  private _dbName: string = "IDB";
  private _expirationTime?: number;

  public constructor(dbName: string, expirationTime?: number) {
    this._dbName = dbName;
    if (expirationTime) {
      this._expirationTime = expirationTime;
    }
  }

  protected async open(){

    // need to return a promise so that we can wait for the db to open before using it
    return new Promise(function (this: IndexedDBCache, resolve) {

      // open the db
      const openDB = window.indexedDB.open(this._dbName, 1);

      openDB.onerror = () => {
        Logger.logError(loggerCategory, "Error opening IndexedDB");
      };

      // this is the success callback for opening the db, it is called after onupgradeneeded
      openDB.onsuccess = async (event) => {

        const target: any = event.target;
        if (target) {
          this._db = target.result;
          return resolve(target.result);
        }
      };

      // This will get called when a new version is needed - including going from no database to first version
      // So this is how we set up the specifics of the db structure
      openDB.onupgradeneeded = async (event) => {
        const target: any = event.target;

        if (target)
          this._db = target.result;

        const initialObjectStore = this._db.createObjectStore("cache", { keyPath: "uniqueId" });
        initialObjectStore.createIndex("content", "content", {unique: false});
        initialObjectStore.createIndex("timeOfStorage", "timeOfStorage", {unique: false});
      };
    });
  }

  protected async close() {
    await this._db.close();
  }

  protected async retrieveContent(uniqueId: string): Promise<ArrayBuffer | undefined> {
    return new Promise(async (resolve) => {
      await this.open();
      const getTransaction = await this._db.transaction("cache", "readonly");
      const storedResponse = await getTransaction.objectStore("cache").get(uniqueId);

      // this is successful if the db was successfully searched - not only if a match was found
      storedResponse.onsuccess = async () => {

        if (storedResponse.result !== undefined) {

          // if the content has an expiration time
          if (this._expirationTime) {
            // We want to know when the result was stored, and how long it's been since that point
            const timeSince = Date.now() - storedResponse.result.timeOfStorage;

            // If it's been greater than our time limit, delete it and return undefined.
            if (timeSince > this._expirationTime) {
              await this.deleteContent(uniqueId);
              return resolve(undefined);
            }
          }
          const content = storedResponse.result.content;
          await this.close();
          return resolve(content);
        }

        await this.close();
        return resolve(undefined);
      };

      storedResponse.onerror = async () => {
        Logger.logError(loggerCategory, "Error retrieving content from IndexedDB");
      };
    });
  }

  protected async deleteContent(uniqueId: string) {
    return new Promise(async (resolve) => {
      await this.open();
      const deleteTransaction = await this._db.transaction("cache", "readwrite");
      const requestDelete = await deleteTransaction.objectStore("cache").delete(uniqueId);

      requestDelete.onerror = () => {
        Logger.logError(loggerCategory, "Error deleting content from IndexedDB");
      };

      deleteTransaction.oncomplete = async () => {
        await this.close();
        return resolve(undefined);
      };

      deleteTransaction.onerror = async () => {
        Logger.logError(loggerCategory, "Error deleting content from IndexedDB");
      };
    });
  }

  protected async addContent(uniqueId: string, content: ArrayBuffer) {
    return new Promise(async (resolve) => {
      await this.open();
      const addTransaction = await this._db.transaction("cache", "readwrite");
      const objectStore = await addTransaction.objectStore("cache");

      const data = {
        uniqueId,
        content,
        timeOfStorage: Date.now(),
      };

      const requestAdd = await objectStore.add(data);

      requestAdd.onerror = () => {
        Logger.logError(loggerCategory, "Error adding content to IndexedDB");
      };

      addTransaction.oncomplete = async () => {
        await this.close();
        return resolve(undefined);
      };

      addTransaction.onerror = async () => {
        Logger.logError(loggerCategory, "Error adding content to IndexedDB in add transaction");
        await this.close();
        return resolve(undefined);
      };
    });
  }

  public async fetch(uniqueId: string, callback: (url: string) => Promise<Response>, callBackUrl?: string): Promise<ArrayBuffer> {
    let response = await this.retrieveContent(uniqueId);

    // If nothing was found in the db
    if (response === undefined) {

      // If necessary, use the callback url
      if (callBackUrl)
        uniqueId = callBackUrl;

      // fetch normally, then add that content to the db
      response = await (await callback(uniqueId)).arrayBuffer();
      await this.addContent(uniqueId, response);
    }

    return response;
  }
}

