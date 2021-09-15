/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { TextureLoadProps } from "@bentley/imodeljs-common";
import { SnapshotDb } from "../../IModelDb";
import { IModelTestUtils } from "../IModelTestUtils";

describe("IModelDb.queryTextureData", () => {
  let imodel: SnapshotDb;
  const ctxt = new ClientRequestContext();

  before(() => {
    imodel = IModelTestUtils.createSnapshotFromSeed(IModelTestUtils.prepareOutputFile("ElementGraphics", "mirukuru.ibim"), IModelTestUtils.resolveAssetFile("mirukuru.ibim"));
  });

  after(() => imodel.close());

  it("returns undefined if texture not found", async () => {
    expect(await imodel.queryTextureData(ctxt, { name: "0x123" })).to.be.undefined;
  });

  describe("throws", () => {
    it("if name is not a valid Id", async () => {
      await expect(imodel.queryTextureData(ctxt, { } as unknown as TextureLoadProps)).to.be.rejectedWith("queryTextureData name property must be a valid Id64String");
      await expect(imodel.queryTextureData(ctxt, { name: "0" })).to.be.rejectedWith("queryTextureData name property must be a valid Id64String");
      await expect(imodel.queryTextureData(ctxt, { name: "NotAnId" })).to.be.rejectedWith("queryTextureData name property must be a valid Id64String");
    });

    it("if max size is not a positive number", async () => {
      await expect(imodel.queryTextureData(ctxt, { name: "0x123", maxTextureSize: "25" } as unknown as TextureLoadProps)).to.be.rejectedWith("queryTextureData maxTextureSize property must be a positive number");
      await expect(imodel.queryTextureData(ctxt, { name: "0x123", maxTextureSize: 0 })).to.be.rejectedWith("queryTextureData maxTextureSize property must be a positive number");
      await expect(imodel.queryTextureData(ctxt, { name: "0x123", maxTextureSize: -1 })).to.be.rejectedWith("queryTextureData maxTextureSize property must be a positive number");
    });
  });
});
