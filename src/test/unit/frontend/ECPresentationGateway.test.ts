/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import FrontendGatewayConfiguration from "../../helpers/TestGatewayConfiguration";
import ECPresentationGateway from "@bentley/ecpresentation-frontend/lib/ECPresentationGateway";

describe("ECPresentationGateway", () => {

  describe("getProxy", () => {

    it("throws when not registered", () => {
      assert.throws(() => {
        ECPresentationGateway.getProxy();
      });
    });

    it("returns gateway when registered", () => {
      FrontendGatewayConfiguration.initialize([ECPresentationGateway]);
      const proxy = ECPresentationGateway.getProxy();
      assert.isNotNull(proxy);
      assert.instanceOf(proxy, ECPresentationGateway);
    });

  });

});
