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
      it("reads family names", () => {
        function expectFamilyNames(expected: string[], fontName: string, subDir?: string): void {
          const fileName = IModelTestUtils.resolveFontFile(fontName, subDir);
          const fontFile = TrueTypeFontFile.fromFileName(fileName);
          expected.sort();
          const actual = fontFile.familyNames.slice().sort();
          expect(actual).to.deep.equal(expected);
        }

        expectFamilyNames(["Karla"], "Karla-MultipleEmbeddingRights.ttf", "Karla");
        expectFamilyNames(["Karla"], "Karla-Regular.ttf", "Karla");
        expectFamilyNames(["Karla-Preview-And-Print"], "Karla-Preview-And-Print.ttf", "Karla");
        expectFamilyNames(["Karla-Restricted"], "Karla-Restricted.ttf", "Karla");

        expectFamilyNames(["DejaVu Sans"], "DejaVuSans.ttf", "DejaVu");
        expectFamilyNames(["DejaVu Sans"], "DejaVuSans-Bold.ttf", "DejaVu");
        expectFamilyNames(["DejaVu Sans Mono"], "DejaVuSansMono.ttf", "DejaVu");
        expectFamilyNames(["DejaVu Sans Mono"], "DejaVuSansMono-Bold.ttf", "DejaVu");
        expectFamilyNames(["DejaVu Sans Mono"], "DejaVuSansMono-Oblique.ttf", "DejaVu");
        expectFamilyNames(["DejaVu Sans Mono"], "DejaVuSansMono-BoldOblique.ttf", "DejaVu");
        expectFamilyNames(["DejaVu Serif"], "DejaVuSerif.ttf", "DejaVu");
        expectFamilyNames(["DejaVu Serif"], "DejaVuSerif-Bold.ttf", "DejaVu");
        
        expectFamilyNames([
          "Sitka Banner", "Sitka Display", "Sitka Heading", "Sitka Small", "Sitka Subheading", "Sitka Text",
        ], "Sitka.ttc", "Sitka");
      });
    });
  })
});
