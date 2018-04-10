/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import ECPresentation from "./ECPresentation";
import ECPresentationManager from "./ECPresentationManager";

describe("ECPresentation", () => {

  describe("initialize", () => {

    it("creates manager instance", () => {
      expect(() => ECPresentation.manager).to.throw();
      ECPresentation.initialize();
      expect(ECPresentation.manager).to.be.instanceof(ECPresentationManager);
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
