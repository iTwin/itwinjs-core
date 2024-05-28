/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IndexedDBCache } from "../IndexedDBCache";

// For Testing Only
class TestCache extends IndexedDBCache{

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

  it("should fetch content stored with one sasurl by searching with a different sasurl from the same export", async () => {
    const sasurl1 = "https://d16xw3k7duz3ee.cloudfront.net/4e90a016-44c3-4360-9221-148c44ff0efe/6-0.imdl?sv=2023-11-03&spr=https&se=2024-05-25T23%3A59%3A59Z&sr=c&sp=rl&sig=0gakAKQ6p4IrI6rQl6yFh8vd5a4GM2kOIGZojnxiZfM%3D&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9kMTZ4dzNrN2R1ejNlZS5jbG91ZGZyb250Lm5ldC80ZTkwYTAxNi00NGMzLTQzNjAtOTIyMS0xNDhjNDRmZjBlZmUvKiIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTcxNjY4MTU5OX19fV19&Key-Pair-Id=KMU76EBP5WD92&Signature=YnsGpQov96A4vhtbSi6-Xaz7y4fIdTW9Jzu2Hb3gvUW8noS3J8DUGu7A1N--oI3itXkSk-wM~5xUPh-4QEYE8q5vS40UMiOp5HJIUFl0~jDKVDtTak9GSQgA~rKnU1hsFTzia5BmbuWq5OUr2~XET2h1Q8dImceCXzAgxUYYD47PnO8s163vWH6QUpB5e13AdXyHtx9fS6iCWSCf7R-pn-iWUsGNfeEtYSik~RMecBSIP~mcMPDLQ0gFlfoEPNed-ifSwgCWlPhpCa0-YzBCa7JyhA61bWBZeVltnEJpgVjdOzBUZE3ffxwtTVstE1eySLs8YwmPQoMKJuK34ETRsw__";
    const sasurl2 = "https://d16xw3k7duz3ee.cloudfront.net/4e90a016-44c3-4360-9221-148c44ff0efe/6-0.imdl?sv=2023-11-03&spr=https&se=2024-06-01T23%3A59%3A59Z&sr=c&sp=rl&sig=239RE%2BP%2F9yGEVoMKhoHx9nfFb4qUn3lmkkXc5v0P%2FH4%3D&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9kMTZ4dzNrN2R1ejNlZS5jbG91ZGZyb250Lm5ldC80ZTkwYTAxNi00NGMzLTQzNjAtOTIyMS0xNDhjNDRmZjBlZmUvKiIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTcxNzI4NjM5OX19fV19&Key-Pair-Id=KMU76EBP5WD92&Signature=clm~UkYQW-c3TXOxEtcMqrKo9gAMZoLk6avegh~5xVLmrWxPKSS6jNcapdDc8m3jN6YdI21S-PfXiSKV54IwdCY0mT9dsLLQI3IrD8eVUbNMOefX3wB1jX1c7vQ6EwsVUm3r6bWlmDlHZEDGHz349WxtVxc1Gw3Zmi-qXfK8L~QYM7T8IdeiphRTkLZJMvO7HJUJ1ZfO2hZjk3YYRqqN7ZJiSjV~LjPe-cdONUZc3ZFWunKqWbvubnoroBQomAnbN7BhJnejjsWVFD~DAMEnCOChJnUZTWIHv-ZPqhPVAQuGdjDXn-VdVeDJ0QDCoLpLD2yPHbYQkDjm1~nydszk~Q__";

    const url1 = new URL(sasurl1);
    const url2 = new URL(sasurl2);

    // store content based on pathname from url1
    const content = await cache.convertStringToBuffer(sasurl1);
    await cache.testAddContent(url1.pathname, content);

    // fetched based on pathname from url2
    const fetchedContent = await cache.fetch(url2.pathname, async () => {
      throw new Error("This callback should not be called");
    });

    // the content fetched with the pathname from url2 should be the same as the content stored with the pathname from url1
    const strFetchedContent = await cache.convertBufferToString(fetchedContent);
    expect(strFetchedContent).equal(sasurl1);
  });
});
