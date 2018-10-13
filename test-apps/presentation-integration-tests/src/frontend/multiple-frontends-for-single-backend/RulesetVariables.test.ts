/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { initialize, terminate } from "../../IntegrationTests";
import { OpenMode } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import PresentationManager from "@bentley/presentation-frontend/lib/PresentationManager";

describe("Multiple frontends for one backend", async () => {

  describe("Ruleset Variables", () => {

    let imodel: IModelConnection;
    let frontends: PresentationManager[];

    before(async () => {
      initialize();

      const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
      imodel = await IModelConnection.openStandalone(testIModelName, OpenMode.Readonly);
      expect(imodel).is.not.null;

      frontends = [0, 1].map(() => PresentationManager.create());
    });

    after(async () => {
      await imodel.closeStandalone();
      frontends.forEach((f) => f.dispose());
      terminate();
    });

    it("Handles multiple simultaneous requests from different frontends with ruleset variables", async () => {
      const rulesetId = "RulesetVariables";
      for (let i = 0; i < 100; ++i) {
        frontends.forEach((f, fi) => f.vars(rulesetId).setString("variable_id", `${i}_${fi}`));
        const nodes = await Promise.all(frontends.map((f) => f.getRootNodes({ imodel, rulesetId })));
        frontends.forEach((_f, fi) => {
          expect(nodes[fi][0].label).to.eq(`${i}_${fi}`);
        });
      }
    });

  });

});
