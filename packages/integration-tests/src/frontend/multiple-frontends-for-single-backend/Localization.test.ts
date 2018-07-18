/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { initialize, terminate } from "../../IntegrationTests";
import { OpenMode } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import ECPresentationManager from "@bentley/ecpresentation-frontend/lib/ECPresentationManager";

before(() => {
  initialize();
});

after(() => {
  terminate();
});

describe("Multiple frontends for one backend", async () => {

  describe("Localization", () => {

    let imodel: IModelConnection;
    let frontends: ECPresentationManager[];

    before(async () => {
      const testIModelName: string = "assets/datasets/1K.bim";
      imodel = await IModelConnection.openStandalone(testIModelName, OpenMode.Readonly);
      expect(imodel).is.not.null;

      frontends = ["en", "test"].map((locale) => ECPresentationManager.create({ activeLocale: locale }));
    });

    after(async () => {
      await imodel.closeStandalone();
    });

    it("Handles multiple simultaneous requests from different frontends with different locales", async () => {
      for (let i = 0; i < 100; ++i) {
        const nodes = {
          en: await frontends[0].getRootNodes({ imodel, rulesetId: "Localization" }),
          test: await frontends[1].getRootNodes({ imodel, rulesetId: "Localization" }),
        };

        expect(nodes.en[0].label).to.eq("test value");
        expect(nodes.en[0].description).to.eq("test nested value");

        expect(nodes.test[0].label).to.eq("_test_ string");
        expect(nodes.test[0].description).to.eq("_test_ nested string");
      }
    });

  });

});
