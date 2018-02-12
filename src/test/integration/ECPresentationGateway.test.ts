/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// testing imports:
import { assert } from "chai";
import * as moq from "typemoq";
// frontend imports:
// import FrontendGatewayConfiguration from "../helpers/frontend/FrontendGatewayConfiguration";
// import FrontendGatewayImpl from "@bentley/ecpresentation-frontend/lib/frontend/ECPresentationGateway";
import ECPresentationManagerFrontend from "@bentley/ecpresentation-frontend/lib/frontend/ECPresentationManager";
// backend imports:
import BackendGatewayConfiguration from "../helpers/backend/BackendGatewayConfiguration";
import ECPresentationManagerBackend, { NodeAddonDefinition } from "@bentley/ecpresentation-backend/lib/backend/ECPresentationManager";
import ECPresentationGatewayBackend from "@bentley/ecpresentation-backend/lib/backend/ECPresentationGateway";
import ECPresentationGatewayDefinition from "@bentley/ecpresentation-backend/lib/common/ECPresentationGatewayDefinition";
import { Gateway } from "@bentley/imodeljs-backend/lib/common/Gateway";
import { IModelToken } from "@bentley/imodeljs-backend/lib/common/IModel";
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";

describe.skip("ECPresentationManager", () => {

  const addonMock = moq.Mock.ofType<NodeAddonDefinition>();
  const frontend = new ECPresentationManagerFrontend();

  before(() => {
    // set up backend part
    const managerBackend = new ECPresentationManagerBackend({
      addon: addonMock.object,
      // rulesetDirectories: [path.resolve(__dirname, "assets/presentation_rules")],
    });
    BackendGatewayConfiguration.initialize([ECPresentationGatewayBackend]);
    const backendGateway = Gateway.getImplementationForGateway(ECPresentationGatewayDefinition) as ECPresentationGatewayBackend;
    backendGateway.setManager(managerBackend);
  });

  after(() => {
    addonMock.reset();
  });

  describe("getRootNodesCount", () => {

    it("passes correct parameters and returns count from node addon", async () => {
      const token = IModelToken.create("imodel_id", "changeset_id", OpenMode.Readonly);
      const count = await frontend.getRootNodesCount(token, { sample: "options" });
      assert.equal(count, 999);
    });

  });

});
