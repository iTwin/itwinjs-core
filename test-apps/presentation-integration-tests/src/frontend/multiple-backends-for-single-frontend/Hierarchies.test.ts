/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { initialize, terminate } from "../../IntegrationTests";
import { resetBackend } from "./Helpers";
import { OpenMode } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import PresentationManager from "@bentley/presentation-frontend/lib/PresentationManager";

describe("Multiple backends for one frontend", async () => {

  describe("Hierarchies", () => {

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

    it("Gets child nodes after backend is reset", async () => {
      const props = { imodel, rulesetId: "SimpleHierarchy" };

      const rootNodes = await frontend.getRootNodes(props);
      expect(rootNodes.length).to.eq(1);
      expect(rootNodes[0].key.type).to.eq("root");

      resetBackend();

      const childNodes = await frontend.getChildren(props, rootNodes[0].key);
      expect(childNodes.length).to.eq(1);
      expect(childNodes[0].key.type).to.eq("child");
    });

  });

});
