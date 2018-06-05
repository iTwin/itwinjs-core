/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { initialize, terminate } from ".././IntegrationTests";
import { OpenMode } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
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

    let imodel: IModelConnection;
    let nativePlatform: PresentationManagerNodeAddonDefinition;
    beforeEach(async () => {
      nativePlatform = ECPresentation.manager.getNativePlatform();
      const testIModelName: string = "assets/datasets/1K.bim";
      imodel = await IModelConnection.openStandalone(testIModelName, OpenMode.Readonly);
      expect(imodel).is.not.null;
    });
    afterEach(async () => {
      await imodel.closeStandalone();
    });

    it("throws on closed imodel", async () => {
      const db = nativePlatform.getImodelAddon(imodel.iModelToken);
      await imodel.closeStandalone();
      return expect(nativePlatform.handleRequest(db, "")).eventually.to.be.rejectedWith(ECPresentationError, "iModel: not open");
    });

    it("throws on empty options", async () => {
      const db = nativePlatform.getImodelAddon(imodel.iModelToken);
      return expect(nativePlatform.handleRequest(db, "")).eventually.to.be.rejectedWith(ECPresentationError, "request");
    });

    it("throws on empty request id", async () => {
      const db = nativePlatform.getImodelAddon(imodel.iModelToken);
      return expect(nativePlatform.handleRequest(db, JSON.stringify({requestId: ""}))).eventually.to.be.rejectedWith(ECPresentationError, "request.requestId");
    });

    it("throws on not handled request id", async () => {
      const db = nativePlatform.getImodelAddon(imodel.iModelToken);
      return expect(nativePlatform.handleRequest(db, JSON.stringify({requestId: "Unknown"}))).eventually.to.be.rejectedWith(ECPresentationError, "request.requestId");
    });

  });

});
