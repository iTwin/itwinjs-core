/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IndexedDBCache } from "../../tile/internal";

// For Testing Only
export class TestCache extends IndexedDBCache{

  public constructor(dbName: string, expirationTime?: number) {
    super(dbName, expirationTime);
  }

  public async testDeleteContent(uniqueId: string) {
    await this.deleteContent(uniqueId);
    return;
  }

  public async testAddContent(uniqueId: string, content: ArrayBuffer) {
    await this.addContent(uniqueId, content);
  }

  public async testRetrieveContent(uniqueId: string): Promise<ArrayBuffer | undefined>{
    return this.retrieveContent(uniqueId);
  }

  public async testClose() {
    await this.close();
    return;
  }

  public async convertStringToBuffer(str: string): Promise<ArrayBuffer> {
    return new TextEncoder().encode(str).buffer;
  }

  public async convertBufferToString(buffer: ArrayBuffer): Promise<string> {
    return new TextDecoder().decode(new Uint8Array(buffer)).toString();
  }
}

describe("IndexedDBCache", () => {
  const cache = new TestCache("TestDB");

  it("should add content to the cache", async () => {
    const uniqueId = "test-add";
    const content = await cache.convertStringToBuffer(uniqueId);
    await cache.testAddContent(uniqueId, content);

    const retrievedContent = await cache.testRetrieveContent(uniqueId);
    const strRetrievedContent = await cache.convertBufferToString(retrievedContent!);
    expect(strRetrievedContent).equal(uniqueId);
  });

  it("should delete content from the cache", async () => {
    const uniqueId = "test-delete";
    const content = await cache.convertStringToBuffer(uniqueId);

    await cache.testAddContent(uniqueId, content);
    await cache.testDeleteContent(uniqueId);

    const retrievedContent = await cache.testRetrieveContent(uniqueId);
    expect(retrievedContent).equal(undefined);
  });

  it("should fetch content from the cache if available", async () => {
    const uniqueId = "test-fetch-cache";
    const content = await cache.convertStringToBuffer(uniqueId);

    await cache.testAddContent(uniqueId, content);

    const fetchedContent = await cache.fetch(uniqueId, async () => {
      throw new Error("This callback should not be called");
    });
    const strFetchedContent = await cache.convertBufferToString(fetchedContent);
    expect(strFetchedContent).equal(uniqueId);
  });

  it("should fetch content from the network if not available in the cache", async () => {
    const uniqueId = "test-fetch-network";
    const content = await cache.convertStringToBuffer(uniqueId);

    const fetchedContent = await cache.fetch(uniqueId, async () => {
      return new Response(content);
    });
    const strFetchedContent = await cache.convertBufferToString(fetchedContent);
    expect(strFetchedContent).equal(uniqueId);
  });

  it("should fetch content from the network if expired in the cache", async () => {
    // Set expiration time to -1 to make the content expire immediately
    const expiringCache = new TestCache("ExpiringTestDB", -1);
    const uniqueId = "test-expiring";
    const content = await cache.convertStringToBuffer(uniqueId);

    await expiringCache.testAddContent(uniqueId, content);

    // The content should have expired, and therefore, fetchedContent should be undefined
    let fetchedContent = await expiringCache.testRetrieveContent(uniqueId);
    expect(fetchedContent).equal(undefined);

    // But now fetching from the network, the content should not be undefined
    fetchedContent = await expiringCache.fetch(uniqueId, async () => {
      return new Response(content);
    });

    const strFetchedContent = await expiringCache.convertBufferToString(fetchedContent);
    expect(strFetchedContent).equal(uniqueId);
  });

  it("should not fetch content from the network if not expired in the cache", async () => {
    const expiringCache = new TestCache("NotExpiringTestDB", 1_000_000);
    const uniqueId = "test-not-expiring";
    const content = await cache.convertStringToBuffer(uniqueId);

    await expiringCache.testAddContent(uniqueId, content);

    const fetchedContent = await expiringCache.fetch(uniqueId, async () => {
      throw new Error("This callback should not be called");
    });
    const strFetchedContent = await expiringCache.convertBufferToString(fetchedContent);
    expect(strFetchedContent).equal(uniqueId);
  });
});
