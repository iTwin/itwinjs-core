/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { initialize, terminate } from "../../IntegrationTests";
import { OpenMode } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { SettingValueTypes } from "@bentley/ecpresentation-common";
import ECPresentationManager from "@bentley/ecpresentation-frontend/lib/ECPresentationManager";

before(() => {
  initialize();
});

after(() => {
  terminate();
});

describe("Multiple frontends for one backend", async () => {

  describe("User Settings", () => {

    let imodel: IModelConnection;
    let frontends: ECPresentationManager[];

    before(async () => {
      const testIModelName: string = "assets/datasets/1K.bim";
      imodel = await IModelConnection.openStandalone(testIModelName, OpenMode.Readonly);
      expect(imodel).is.not.null;

      frontends = [0, 1].map(() => ECPresentationManager.create());
    });

    after(async () => {
      await imodel.closeStandalone();
    });

    it("Handles multiple simultaneous requests from different frontends with user settings", async () => {
      const rulesetId = "UserSettings";
      for (let i = 0; i < 100; ++i) {
        frontends.forEach((f, fi) => f.settings(rulesetId).setValue("setting_id", { type: SettingValueTypes.String, value: `${i}_${fi}` }));
        const nodes = await Promise.all(frontends.map((f) => f.getRootNodes({ imodel, rulesetId })));
        frontends.forEach((_f, fi) => {
          expect(nodes[fi][0].label).to.eq(`${i}_${fi}`);
        });
      }
    });

  });

});
