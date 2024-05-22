
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @beta */
export interface ILocalCache {
  fetch(url: string, callback: (uniqueId: string) => Promise<Response>, callBackUrl?: string): Promise<ArrayBuffer>;
}

/** @beta */
export class PassThroughCache implements ILocalCache {
  public async fetch(uniqueId: string, callback: (url: string) => Promise<Response>, callBackUrl?: string): Promise<ArrayBuffer> {
    if (callBackUrl) {
      return (await callback(callBackUrl)).arrayBuffer();
    }
    return (await callback(uniqueId)).arrayBuffer();
  }
}

/** @beta */
export class IndexedDBCache implements ILocalCache{
  private _db: any;
  private _dbName: string = "IDB";
  private _expirationTime?: number;

  public constructor(dbName: string, expirationTime?: number) {
    this._dbName = dbName;
    if (expirationTime) {
      this._expirationTime = expirationTime;
    }
  }

  protected async open(dbCache: IndexedDBCache){

    // need to return a promise so that we can wait for the db to open before using it
    return new Promise(function (resolve) {

      // open the db
      const openDB = window.indexedDB.open(dbCache._dbName, 1);

      openDB.onerror = (event) => {
        console.log("Error opening up DB");
        return resolve(event);
      };

      // this is the success callback for opening the db, it is called after onupgradeneeded
      openDB.onsuccess = async (event) => {
        console.log("Opening this DB: ");

        const target: any = event.target;
        if (target) {
          dbCache._db = target.result;
          console.log(dbCache._db);
          return resolve(target.result);
        }
      };

      // This will get called when a new version is needed - including going from no database to first version
      // So this is how we set up the specifics of the db structure
      openDB.onupgradeneeded = async (event) => {
        console.log("ON UPGRADE NEEDED");
        const target: any = event.target;

        if (target)
          dbCache._db = target.result;

        const initialObjectStore = dbCache._db.createObjectStore("cache", { keyPath: "uniqueId" });
        console.log("create initial data store");

        initialObjectStore.createIndex("content", "content", {unique: false});
        initialObjectStore.createIndex("timeOfStorage", "timeOfStorage", {unique: false});
      };
    });
  }

  protected async close() {
    console.log("Closing DB");
    await this._db.close();
  }

  protected async retrieveContent(uniqueId: string): Promise<ArrayBuffer | undefined> {
    return new Promise(async (resolve) => {
      await this.open(this);
      console.log("Searching for content with this id:");
      console.log(uniqueId);
      const getTransaction = await this._db.transaction("cache", "readonly");
      const storedResponse = await getTransaction.objectStore("cache").get(uniqueId);

      // this is successful if the db was successfully searched - not only if a match was found
      storedResponse.onsuccess = async () => {

        if (storedResponse.result !== undefined) {
          console.log("Stored string found.");

          // if the content has an expiration time
          if (this._expirationTime) {
            // We want to know when the result was stored, and how long it's been since that point
            const timeSince = Date.now() - storedResponse.result.timeOfStorage;
            console.log("Time Since Storage: ", timeSince / 1000, " secs" );

            // If it's been greater than our time limit, delete it and return undefined.
            if (timeSince > this._expirationTime) {
              console.log("Stored string Expired, Deleting content");
              await this.deleteContent(uniqueId);
              return resolve(undefined);
            }
          }
          const content = storedResponse.result.content;
          console.log("Returning the following content: ");
          console.log(content);
          await this.close();
          return resolve(content);
        }

        console.log("No matching results found in db");
        await this.close();
        return resolve(undefined);
      };

      storedResponse.onerror = async () => {
        console.log("Error retrieving content");
        await this.close();
        return resolve(undefined);
      };
    });
  }

  protected async deleteContent(uniqueId: string) {
    return new Promise(async (resolve) => {
      await this.open(this);
      const deleteTransaction = await this._db.transaction("cache", "readwrite");
      const requestDelete = await deleteTransaction.objectStore("cache").delete(uniqueId);

      requestDelete.onsuccess = () => {
        console.log("Content Deleted.");
      };

      deleteTransaction.onsuccess = () => {
        console.log("Delete Transaction Success.");
      };

      deleteTransaction.oncomplete = async () => {
        console.log("Delete Transaction Completed.");
        await this.close();
        return resolve(undefined);
      };

      deleteTransaction.onerror = async () => {
        console.log("Error deleting content");
        await this.close();
        return resolve(undefined);
      };
    });
  }

  protected async addContent(uniqueId: string, content: ArrayBuffer) {
    return new Promise(async (resolve) => {
      await this.open(this);
      const addTransaction = await this._db.transaction("cache", "readwrite");
      const objectStore = await addTransaction.objectStore("cache");

      const data = {
        uniqueId,
        content,
        timeOfStorage: Date.now(),
      };

      console.log("Adding this content to the db:");
      console.log(data);

      const requestAdd = await objectStore.add(data);

      requestAdd.onsuccess = () => {
        console.log("Content added to db.");
      };

      addTransaction.oncomplete = async () => {
        console.log("Write Transaction Completed.");
        await this.close();
        return resolve(undefined);
      };

      addTransaction.onerror = async () => {
        console.log("Error adding content");
        await this.close();
        return resolve(undefined);
      };
    });
  }

  public async fetch(uniqueId: string, callback: (url: string) => Promise<Response>, callBackUrl?: string): Promise<ArrayBuffer> {
    let response = await this.retrieveContent(uniqueId);
    console.log("Response: ", response);

    // If nothing was found in the db
    if (response === undefined) {

      // In some cases, the uniqueId used to store the content in the db is not the same as what is used to fetch the content from the callback.
      // This is the case for tiles from the Mesh Export Service, which are stored in the db with only part of the url used to fetch them.
      // In this case, we need to pass a different callBackUrl to the callBack function.
      if (callBackUrl) {
        uniqueId = callBackUrl;
      }
      // fetch normally, then add that content to the db
      console.log("Fetching using callback");
      response = await (await callback(uniqueId)).arrayBuffer();
      await this.addContent(uniqueId, response);
    }

    return response;
  }
}

