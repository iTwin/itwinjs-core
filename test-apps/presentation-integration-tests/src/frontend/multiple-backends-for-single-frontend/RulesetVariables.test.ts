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
      terminate();
    });

    it("Can use the same frontend-registered ruleset variables after backend is reset", async () => {
      const vars = frontend.vars("SimpleHierarchy");
      const varId = faker.random.uuid();
      const varValue = faker.random.words();

      vars.setString(varId, varValue);
      expect(await vars.getString(varId)).to.eq(varValue);

      resetBackend();

      expect(await vars.getString(varId)).to.eq(varValue);
    });

  });

});
