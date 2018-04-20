/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// testing imports:
import { assert } from "chai";
import * as moq from "typemoq";
// frontend imports:
// import FrontendGatewayConfiguration from "../helpers/TestGatewayConfiguration";
// import FrontendGatewayImpl from "@bentley/ecpresentation-frontend/lib/ECPresentationGateway";
import ECPresentationManagerFrontend from "@bentley/ecpresentation-frontend/lib/ECPresentationManager";
// backend imports:
import BackendGatewayConfiguration from "../test-helpers/TestGatewayConfiguration";
import ECPresentationManagerBackend, { NodeAddonDefinition } from "@bentley/ecpresentation-backend/lib/ECPresentationManager";
import ECPresentationGatewayBackend from "@bentley/ecpresentation-backend/lib/ECPresentationGateway";
import ECPresentationGatewayDefinition from "@bentley/ecpresentation-common/lib/ECPresentationGatewayDefinition";
import { Gateway, IModelToken } from "@bentley/imodeljs-common";

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
    const backendGateway = Gateway.getProxyForGateway(ECPresentationGatewayDefinition) as ECPresentationGatewayBackend;
    backendGateway.setManager(managerBackend);
  });

  after(() => {
    addonMock.reset();
  });

  describe("getRootNodesCount", () => {

    it("passes correct parameters and returns count from node addon", async () => {
      const token = new IModelToken();
      const count = await frontend.getRootNodesCount(token, { sample: "options" });
      assert.equal(count, 999);
    });

  });

});
