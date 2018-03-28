/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import ECPresentation from "./ECPresentation";
import ECPresentationManager from "./ECPresentationManager";
import SelectionManager from "./selection/SelectionManager";

describe("ECPresentation", () => {

  describe("initialize", () => {

    it("creates manager instances", () => {
      expect(() => ECPresentation.presentation).to.throw();
      expect(() => ECPresentation.selection).to.throw();
      ECPresentation.initialize();
      expect(ECPresentation.presentation).to.be.instanceof(ECPresentationManager);
      expect(ECPresentation.selection).to.be.instanceof(SelectionManager);
    });

  });

  describe("terminate", () => {

    it("resets manager instances", () => {
      ECPresentation.initialize();
      expect(ECPresentation.presentation).to.be.not.null;
      expect(ECPresentation.selection).to.be.not.null;
      ECPresentation.terminate();
      expect(() => ECPresentation.presentation).to.throw;
      expect(() => ECPresentation.selection).to.throw;
    });

  });

  describe("[set] presentation", () => {

    it("overwrites presentation manager instance", () => {
      const otherManager = new ECPresentationManager();
      ECPresentation.initialize();
      expect(ECPresentation.presentation).to.be.not.null;
      expect(ECPresentation.presentation).to.not.eq(otherManager);
      ECPresentation.presentation = otherManager;
      expect(ECPresentation.presentation).to.eq(otherManager);
    });

  });

  describe("[set] selection", () => {

    it("overwrites selection manager instance", () => {
      const otherManager = new SelectionManager();
      ECPresentation.initialize();
      expect(ECPresentation.selection).to.be.not.null;
      expect(ECPresentation.selection).to.not.eq(otherManager);
      ECPresentation.selection = otherManager;
      expect(ECPresentation.selection).to.eq(otherManager);
    });

  });

});
