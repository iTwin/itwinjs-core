/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import FrontendGatewayConfiguration from "../../helpers/frontend/FrontendGatewayConfiguration";
import ECPresentationGateway from "@bentley/ecpresentation-frontend/lib/frontend/ECPresentationGateway";

describe("ECPresentationGateway", () => {

  describe("getProxy", () => {

    it("Throws when not registered", () => {
      assert.throws(() => {
        ECPresentationGateway.getProxy();
      });
    });

    it("Returns gateway when registered", () => {
      FrontendGatewayConfiguration.initialize([ECPresentationGateway]);
      const proxy = ECPresentationGateway.getProxy();
      assert.isNotNull(proxy);
      assert.instanceOf(proxy, ECPresentationGateway);
    });

  });

});
