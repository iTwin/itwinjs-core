/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Gateway } from "@bentley/imodeljs-common";
import { ECPresentationGatewayDefinition } from "@bentley/ecpresentation-common";
import ECPresentation from "./ECPresentation";
import ECPresentationManager from "./ECPresentationManager";
import ECPresentationGateway from "./ECPresentationGateway";
import { initializeGateway } from "../test-helpers/GatewayHelper";

describe("ECPresentation", () => {

  describe("initialize", () => {

    it("registers gateway and creates manager instance", () => {
      expect(() => ECPresentation.manager).to.throw();
      ECPresentation.initialize();
      initializeGateway(ECPresentationGateway);
      expect(ECPresentation.manager).to.be.instanceof(ECPresentationManager);
      expect(Gateway.getImplementationForGateway(ECPresentationGatewayDefinition)).to.be.instanceof(ECPresentationGateway);
    });

  });

  describe("terminate", () => {

    it("resets manager instance", () => {
      ECPresentation.initialize();
      expect(ECPresentation.manager).to.be.not.null;
      ECPresentation.terminate();
      expect(() => ECPresentation.manager).to.throw;
    });

  });

  describe("[set] manager", () => {

    it("overwrites manager instance", () => {
      const otherManager = new ECPresentationManager();
      ECPresentation.initialize();
      expect(ECPresentation.manager).to.be.not.null;
      expect(ECPresentation.manager).to.not.eq(otherManager);
      ECPresentation.manager = otherManager;
      expect(ECPresentation.manager).to.eq(otherManager);
    });

  });

});
