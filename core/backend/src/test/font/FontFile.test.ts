/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect} from "chai";
import * as fs from "fs";
import { IModelTestUtils } from "../IModelTestUtils";
import { CadFontFile, FontFile, TrueTypeFontFile } from "../../Font";
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
  
describe.only("CadFontFile", () => {
  describe("create", () => {
    it("throws on non-existent filename", () => {
      let fileName = IModelTestUtils.resolveFontFile("Cdm.shx");
      expect(fs.existsSync(fileName)).to.be.true;
      fileName = fileName + "no-existe";
      expect(fs.existsSync(fileName)).to.be.false;
      expect(() => CadFontFile.create({ fileName, familyName: "Cdm" })).to.throw();
    });
  
    it("detects font type", () => {
    
    });

    it("throws on non-existent filename", () => {
      let fileName = IModelTestUtils.resolveFontFile("Cdm.shx");
      expect(fs.existsSync(fileName)).to.be.true;
      fileName = fileName + "no-existe";
      expect(fs.existsSync(fileName)).to.be.false;
      expect(() => CadFontFile.create({ fileName, familyName: "Cdm" })).to.throw();
    });

    it("throws on non-font data", () => {
      const fileName = IModelTestUtils.resolveAssetFile("brepdata1.json");
      expect(fs.existsSync(fileName)).to.be.true;
      expect(() => TrueTypeFontFile.fromFileName(fileName)).to.throw();

      const blob = fs.readFileSync(fileName);
      expect(blob.length).greaterThan(5);
      expect(() => CadFontFile.create({ blob, familyName: "brepdata1" })).to.throw();
    });

  });
});

describe.only("TrueTypeFontFile", () => {
  describe("fromFileName", () => {
    it("throws on non-existent filename", () => {
    
    });

    it("throws on non-font data", () => {
      
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

    describe("familyNames", () => {
      
    });
  })
});
