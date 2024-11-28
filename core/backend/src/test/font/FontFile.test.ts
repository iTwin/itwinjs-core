/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect} from "chai";
import * as fs from "fs";
import { IModelTestUtils } from "../IModelTestUtils";
import { FontFile } from "../../Font";
import { FontType } from "@itwin/core-common";

interface FontData {
  blob: Uint8Array;
  fileName: string;
}

function getFontData(fontName: string, fontSubDirectory?: string): FontData {
  const fileName = IModelTestUtils.resolveFontFile(fontName, fontSubDirectory);
  expect(fs.existsSync(fileName)).to.be.true;
  const blob = fs.readFileSync(fileName);
  return { fileName, blob };
}
  
describe.only("FontFile", () => {
  it("wip", () => {
    expect(IModelTestUtils.resolveFontFile("Karla-Regular.ttf", "Karla").length).greaterThan(5);
    expect(IModelTestUtils.resolveFontFile("Cdm.shx").length).greaterThan(5);
  });

  describe("fromFileName/Blob", () => {
    it("throws on non-existent filename", () => {
      let fileName = IModelTestUtils.resolveFontFile("Cdm.shx");
      expect(fs.existsSync(fileName)).to.be.true;
      fileName = fileName + "no-existe";
      expect(fs.existsSync(fileName)).to.be.false;
      expect(() => FontFile.fromFileName(fileName)).to.throw();
    });

    it("throws on non-font data", () => {
      const fileName = IModelTestUtils.resolveAssetFile("brepdata1.json");
      expect(fs.existsSync(fileName)).to.be.true;
      expect(() => FontFile.fromFileName(fileName)).to.throw();

      const blob = fs.readFileSync(fileName);
      expect(blob.length).greaterThan(5);
      expect(() => FontFile.fromBlob({ type: FontType.Shx, blob })).to.throw();
    });

    it("detects font type", () => {
    
    });

    it("throws if specified font type does not match detected type", () => {
      
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
