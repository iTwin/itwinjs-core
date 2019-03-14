/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import { initialize, terminate } from "../../IntegrationTests";
import { resetBackend } from "./Helpers";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { PresentationManager } from "@bentley/presentation-frontend";

describe("Multiple backends for one frontend", async () => {

  describe("RulesetVariables", () => {

    let imodel: IModelConnection;
    let frontend: PresentationManager;

    before(async () => {
      initialize();
      const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
      imodel = await IModelConnection.openSnapshot(testIModelName);
      expect(imodel).is.not.null;
      frontend = PresentationManager.create();
    });

    after(async () => {
      await imodel.closeSnapshot();
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
