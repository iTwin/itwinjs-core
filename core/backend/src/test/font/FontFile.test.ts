/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect} from "chai";
import { IModelTestUtils } from "../IModelTestUtils";

describe.only("FontFile", () => {
  it("wip", () => {
    expect(IModelTestUtils.resolveFontFile("Karla-Regular.ttf", "Karla").length).greaterThan(5);
    expect(IModelTestUtils.resolveFontFile("Cdm.shx").length).greaterThan(5);
  });

  describe("fromFileName", () => {
    it("throws on non-existent filename", () => {
    
    });

    it("throws if file is not a font format", () => {
      
    });

    it("throws if file type does not match font type in file data", () => {
      
    });
  });

  describe("fromBlob", () => {
    it("throws on non-font data", () => {
      
    });

    it("throws if specified font type does not match detected type", () => {
      
    });

    it("detects font type", () => {
    
    });
  });
  
  describe("isEmbeddable", () => {
    it("prohibits embedding of restricted and preview-and-print faces", () => {
      
    });

    it("prohibits embedding a file if any face is not embeddable", () => {
      
    });

    it("uses the least restrictive embedding rights if multiple bits are set", () => {
      
    });

    it("is always true for rsc and shx fonts", () => {
      
    });
  })
});
