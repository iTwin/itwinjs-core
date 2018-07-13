/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { initialize, terminate } from "../IntegrationTests";
import { OpenMode } from "@bentley/bentleyjs-core";
import { IModelDb } from "@bentley/imodeljs-backend";
import { ECPresentationError } from "@common/index";
import { ECPresentation } from "@bentley/ecpresentation-backend";
import { NodeAddonDefinition as PresentationManagerNodeAddonDefinition } from "@bentley/ecpresentation-backend/lib/ECPresentationManager";

before(() => {
  initialize();
});

after(() => {
  terminate();
});

describe("ECPresentationManager", () => {

  describe("calling default addon implementation", () => {

    let imodel: IModelDb;
    let nativePlatform: PresentationManagerNodeAddonDefinition;
    beforeEach(async () => {
      nativePlatform = ECPresentation.manager.getNativePlatform();
      const testIModelName: string = "assets/datasets/1K.bim";
      imodel = IModelDb.openStandalone(testIModelName, OpenMode.Readonly);
      expect(imodel).is.not.null;
    });
    afterEach(async () => {
      try {
        imodel.closeStandalone();
      } catch (_e) { }
    });

    it("throws on closed imodel", async () => {
      imodel.closeStandalone();
      expect(() => nativePlatform.getImodelAddon(imodel)).to.throw(ECPresentationError);
    });

    it("throws on empty options", async () => {
      const db = nativePlatform.getImodelAddon(imodel);
      await expect(nativePlatform.handleRequest(db, "")).to.eventually.be.rejectedWith(ECPresentationError, "request");
    });

    it("throws on empty request id", async () => {
      const db = nativePlatform.getImodelAddon(imodel);
      await expect(nativePlatform.handleRequest(db, JSON.stringify({ requestId: "" }))).to.eventually.be.rejectedWith(ECPresentationError, "request.requestId");
    });

    it("throws on not handled request id", async () => {
      const db = nativePlatform.getImodelAddon(imodel);
      await expect(nativePlatform.handleRequest(db, JSON.stringify({ requestId: "Unknown" }))).to.eventually.be.rejectedWith(ECPresentationError, "request.requestId");
    });

  });

});
