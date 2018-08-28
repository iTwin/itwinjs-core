/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import { initialize, terminate } from "../../IntegrationTests";
import { resetBackend } from "./Helpers";
import { OpenMode } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import PresentationManager from "@bentley/presentation-frontend/lib/PresentationManager";

describe("Multiple backends for one frontend", async () => {

  describe("RulesetVariables", () => {

    let imodel: IModelConnection;
    let frontend: PresentationManager;

    before(async () => {
      initialize();
      const testIModelName: string = "assets/datasets/1K.bim";
      imodel = await IModelConnection.openStandalone(testIModelName, OpenMode.Readonly);
      expect(imodel).is.not.null;
      frontend = PresentationManager.create();
    });

    after(async () => {
      await imodel.closeStandalone();
      frontend.dispose();
      terminate();
    });

    it("Can use the same frontend-registered ruleset variables after backend is reset", async () => {
      const vars = frontend.vars("SimpleHierarchy");
      const var1: [string, string] = [faker.random.uuid(), faker.random.words()];
      const var2: [string, number] = [faker.random.uuid(), faker.random.number()];

      await vars.setString(var1[0], var1[1]);
      expect(await vars.getString(var1[0])).to.eq(var1[1]);

      resetBackend();

      expect(await vars.getString(var1[0])).to.eq(var1[1]);
      await vars.setInt(var2[0], var2[1]);
      expect(await vars.getInt(var2[0])).to.eq(var2[1]);

      resetBackend();

      expect(await vars.getString(var1[0])).to.eq(var1[1]);
      expect(await vars.getInt(var2[0])).to.eq(var2[1]);
    });

  });

});
