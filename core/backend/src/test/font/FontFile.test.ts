/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as fs from "fs";
import { IModelTestUtils } from "../IModelTestUtils";
import { FontFile, ShxFontFile, TrueTypeFontFile } from "../../Font";
import { FontType } from "@itwin/core-common";

const expect = chai.expect;
chai.use(chaiAsPromised);

interface FontData {
  blob: Uint8Array;
  fileName: string;
}

describe.only("ShxFontFile", () => {
  describe("create", () => {
    it("creates from blob", () => {
      const fileName = IModelTestUtils.resolveFontFile("Cdm.shx");
      const blob = fs.readFileSync(fileName);
      const font = ShxFontFile.fromBlob({ blob, familyName: "Cdm" });
      expect(font.type).to.equal(FontType.Shx);
      expect(font.familyName).to.equal("Cdm");
    });

    it("creates from file name", async () => {
      const fileName = IModelTestUtils.resolveFontFile("Cdm.shx");
      const font = await ShxFontFile.fromFileName({ fileName, familyName: "Cdm" });
      expect(font.type).to.equal(FontType.Shx);
      expect(font.familyName).to.equal("Cdm");
    });

    it("throws on non-existent filename", async () => {
      let fileName = IModelTestUtils.resolveFontFile("Cdm.shx");
      expect(fs.existsSync(fileName)).to.be.true;
      fileName = fileName + "no-existe";
      expect(fs.existsSync(fileName)).to.be.false;
      await expect(ShxFontFile.fromFileName({ fileName, familyName: "Cdm" })).to.eventually.be.rejectedWith("no such file");
    });

    it("throws on non-font data", async () => {
      const fileName = IModelTestUtils.resolveAssetFile("brepdata1.json");
      expect(fs.existsSync(fileName)).to.be.true;
      await expect(ShxFontFile.fromFileName({ fileName, familyName: "brepdata1" })).to.eventually.be.rejectedWith("Failed to read font file");

      const blob = fs.readFileSync(fileName);
      expect(blob.length).greaterThan(5);
      expect(() => ShxFontFile.fromBlob({ blob, familyName: "brepdata1" })).to.throw("Failed to read font file");
    });
  });
});

describe.only("TrueTypeFontFile", () => {
  describe("fromFileName", () => {
    it("throws on non-existent filename", async () => {
      let fileName = IModelTestUtils.resolveFontFile("Karla-Regular.ttf");
      expect(fs.existsSync(fileName)).to.be.true;
      fileName = fileName + "no-existe";
      expect(fs.existsSync(fileName)).to.be.false;
      await expect(TrueTypeFontFile.fromFileName(fileName)).to.eventually.be.rejectedWith("Failed to read font file");
    });

    it("throws on non-font data", async () => {
      const fileName = IModelTestUtils.resolveAssetFile("brepdata1.json");
      expect(fs.existsSync(fileName)).to.be.true;
      await expect(TrueTypeFontFile.fromFileName(fileName)).to.eventually.be.rejectedWith("Failed to read font file");
    });
  });
  
  describe("isEmbeddable", () => {
    async function expectEmbeddable(expected: boolean, fontName: string): Promise<void> {
      const fileName = IModelTestUtils.resolveFontFile(fontName);
      const fontFile = await TrueTypeFontFile.fromFileName(fileName);
      expect(fontFile.isEmbeddable).to.equal(expected);
    }

    it("prohibits embedding of restricted and preview-and-print faces", async () => {
      await expectEmbeddable(false, "Karla-Restricted.ttf");
      await expectEmbeddable(false, "Karla-Preview-And-Print.ttf");

      await expectEmbeddable(true, "Karla-Regular.ttf");

      await expectEmbeddable(true, "DejaVuSansMono.ttf");
      await expectEmbeddable(true, "Sitka-Banner.ttf");
    });

    it("prohibits embedding a file if any face is not embeddable", async () => {
      await expectEmbeddable(true, "Sitka.ttc");
      
      // ###TODO need a file with one face not embeddable
    });

    it("uses the least restrictive embedding rights if multiple bits are set", () => {
      expectEmbeddable(true, "Karla-MultipleEmbeddingRights.ttf");
    });

    describe("familyNames", () => {
      it("reads family names", async () => {
        async function expectFamilyNames(expected: string[], fontName: string): Promise<void> {
          const fileName = IModelTestUtils.resolveFontFile(fontName);
          const fontFile = await TrueTypeFontFile.fromFileName(fileName);
          expected.sort();
          const actual = fontFile.familyNames.slice().sort();
          expect(actual).to.deep.equal(expected);
        }

        await expectFamilyNames(["Karla"], "Karla-MultipleEmbeddingRights.ttf");
        await expectFamilyNames(["Karla"], "Karla-Regular.ttf");
        await expectFamilyNames(["Karla-Preview-And-Print"], "Karla-Preview-And-Print.ttf");
        await expectFamilyNames(["Karla-Restricted"], "Karla-Restricted.ttf");

        await expectFamilyNames(["DejaVu Sans"], "DejaVuSans.ttf");
        await expectFamilyNames(["DejaVu Sans"], "DejaVuSans-Bold.ttf");
        await expectFamilyNames(["DejaVu Sans Mono"], "DejaVuSansMono.ttf");
        await expectFamilyNames(["DejaVu Sans Mono"], "DejaVuSansMono-Bold.ttf");
        await expectFamilyNames(["DejaVu Sans Mono"], "DejaVuSansMono-Oblique.ttf");
        await expectFamilyNames(["DejaVu Sans Mono"], "DejaVuSansMono-BoldOblique.ttf");
        await expectFamilyNames(["DejaVu Serif"], "DejaVuSerif.ttf");
        await expectFamilyNames(["DejaVu Serif"], "DejaVuSerif-Bold.ttf");
        
        await expectFamilyNames([
          "Sitka Banner", "Sitka Display", "Sitka Heading", "Sitka Small", "Sitka Subheading", "Sitka Text",
        ], "Sitka.ttc");
      });
    });
  })
});
