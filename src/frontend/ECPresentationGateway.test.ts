/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import FrontendGatewayConfiguration from "../test-helpers/TestGatewayConfiguration";
import ECPresentationGateway from "./ECPresentationGateway";

describe("ECPresentationGateway", () => {

  describe("getProxy", () => {

    it("throws when not registered", () => {
      expect(() => ECPresentationGateway.getProxy()).to.throw();
    });

    it("returns gateway when registered", () => {
      FrontendGatewayConfiguration.initialize([ECPresentationGateway]);
      const proxy = ECPresentationGateway.getProxy();
      expect(proxy).is.not.null;
      expect(proxy).is.instanceof(ECPresentationGateway);
    });

  });

});
