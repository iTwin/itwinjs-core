/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// testing imports:
import { assert } from "chai";
// frontend imports:
import FrontendGatewayConfiguration from "../helpers/frontend/FrontendGatewayConfiguration";
import FrontendGatewayImpl from "@bentley/ecpresentation-frontend/lib/frontend/ECPresentationGateway";
// backend imports:
import BackendGatewayConfiguration from "../helpers/backend/BackendGatewayConfiguration";
import BackendGatewayImpl from "@bentley/ecpresentation-backend/lib/backend/ECPresentationGateway";
import { IModelToken } from "@bentley/imodeljs-frontend/lib/common/IModel";
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";

describe("ECPresentationGateway", () => {

  let frontend: FrontendGatewayImpl | null = null;
  const getFrontendGateway = (): FrontendGatewayImpl => frontend!;

  before(() => {
    // set up backend part
    BackendGatewayConfiguration.initialize([BackendGatewayImpl]);
    // set up frontend part
    FrontendGatewayConfiguration.initialize([FrontendGatewayImpl]);
    frontend = FrontendGatewayImpl.getProxy();
  });

  after(() => {
  });

  describe("Marshaling", () => {

    it.skip("Marshals getRootNodes call", async () => {
      const token = IModelToken.create("imodel_id", "changeset_id", OpenMode.Readonly);
      await getFrontendGateway().getRootNodes(token, { pageStart: 0, pageSize: 0 }, {});
      assert.isTrue(true);
    });

  });

});
