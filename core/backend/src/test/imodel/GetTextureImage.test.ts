/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TextureLoadProps } from "@itwin/core-common";
import { SnapshotDb } from "../../IModelDb.js";
import { IModelTestUtils } from "../IModelTestUtils.js";
import { TestUtils } from "../TestUtils.js";

describe("IModelDb.queryTextureData", () => {
  let imodel: SnapshotDb;

  beforeAll(async () => {
    await TestUtils.startBackend();
    imodel = IModelTestUtils.createSnapshotFromSeed(IModelTestUtils.prepareOutputFile("ElementGraphics", "mirukuru.ibim"), IModelTestUtils.resolveAssetFile("mirukuru.ibim"));
  });

  afterAll(async () => {
    imodel.close()
    await TestUtils.shutdownBackend();
  });

  it("returns undefined if texture not found", async () => {
    expect(await imodel.queryTextureData({ name: "0x123" })).to.be.undefined;
  });

  describe("throws", () => {
    it("if name is not a valid Id", async () => {
      await expect(imodel.queryTextureData({} as unknown as TextureLoadProps)).rejects.toThrow("name property must be a valid Id64String");
      await expect(imodel.queryTextureData({ name: "0" })).rejects.toThrow("name property must be a valid Id64String");
      await expect(imodel.queryTextureData({ name: "NotAnId" })).rejects.toThrow("name property must be a valid Id64String");
    });

    it("if max size is not a positive number", async () => {
      await expect(imodel.queryTextureData({ name: "0x123", maxTextureSize: "25" } as unknown as TextureLoadProps)).rejects.toThrow("maxTextureSize property must be a positive number");
      await expect(imodel.queryTextureData({ name: "0x123", maxTextureSize: 0 })).rejects.toThrow("maxTextureSize property must be a positive number");
      await expect(imodel.queryTextureData({ name: "0x123", maxTextureSize: -1 })).rejects.toThrow("maxTextureSize property must be a positive number");
    });
  });
});
