/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import { expect } from "chai";
import { FontFace, FontType } from "@itwin/core-common";
import { IModelTestUtils } from "../IModelTestUtils";
import { FontFile } from "../../FontFile";
import { IModelJsNative } from "@bentley/imodeljs-native";
import { CadFontFile } from "../../internal/FontFileImpl";
import { _key } from "../../internal/Symbols";

function expectFaces(file: FontFile, expected: FontFace[]): void {
  const actual = Array.from(file.faces);
  expect(actual).to.deep.equal(expected);
}

describe.only("FontFile", () => {
  describe("createFromShxBlob", () => {
    it("creates a valid font", () => {
      const fileName = IModelTestUtils.resolveFontFile("Cdm.shx");
      const blob = fs.readFileSync(fileName);

      const file = FontFile.createFromShxFontBlob({ familyName: "Cdm", blob });
      expect(file.type).to.equal(FontType.Shx);
      expect(file.isEmbeddable).to.be.true;
      expectFaces(file, [{ familyName: "Cdm", isBold: false, isItalic: false }])
      });

    it("throws on non-font data", () => {
      const fileName = IModelTestUtils.resolveAssetFile("brepdata1.json");
      expect(fs.existsSync(fileName)).to.be.true;

      const blob = fs.readFileSync(fileName);
      expect(blob.length).greaterThan(5);

      expect(() => FontFile.createFromShxFontBlob({ familyName: "brepdata1", blob })).to.throw("Failed to read font file");
    });
  });

  describe("TrueType fonts", () => {
    describe("createFromTrueTypeFileName", () => {
      it("throws on non-existent file", () => {
        let fileName = IModelTestUtils.resolveFontFile("Karla-Regular.ttf");
        expect(fs.existsSync(fileName)).to.be.true;
        fileName = fileName + "no-existe";
        expect(fs.existsSync(fileName)).to.be.false;
        expect(() => FontFile.createFromTrueTypeFileName(fileName)).to.throw("Failed to read font file");
      });

      it("throws on non-font data", () => {
        const fileName = IModelTestUtils.resolveAssetFile("brepdata1.json");
        expect(fs.existsSync(fileName)).to.be.true;
        expect(() => FontFile.createFromTrueTypeFileName(fileName)).to.throw("Failed to read font file");
      });

      it("reads faces", () => {
        function expectTTFaces(expected: Array<[name: string, isBold?: boolean, isItalic?: boolean]>, fontName: string): void {
          const fileName = IModelTestUtils.resolveFontFile(fontName);
          const fontFile = FontFile.createFromTrueTypeFileName(fileName);
          expect(fontFile.type).to.equal(FontType.TrueType);

          const expectedFaces = expected.map((x) => { return { familyName: x[0], isBold: !!x[1], isItalic: !!x[2] } });
          expect(fontFile.faces.length).to.equal(expectedFaces.length);
          expect(fontFile.faces).to.deep.equal(expectedFaces);
        }

        expectTTFaces([ ["Karla"] ], "Karla-MultipleEmbeddingRights.ttf");
        expectTTFaces([ ["Karla"] ], "Karla-Regular.ttf");
        expectTTFaces([ ["Karla-Preview-And-Print"] ], "Karla-Preview-And-Print.ttf");
        expectTTFaces([ ["Karla-Restricted"] ], "Karla-Restricted.ttf");

        expectTTFaces([ ["DejaVu Sans"] ], "DejaVuSans.ttf");
        expectTTFaces([ ["DejaVu Sans", true] ], "DejaVuSans-Bold.ttf");
        expectTTFaces([ ["DejaVu Sans Mono"] ], "DejaVuSansMono.ttf");
        expectTTFaces([ ["DejaVu Sans Mono", true] ], "DejaVuSansMono-Bold.ttf");
        expectTTFaces([ ["DejaVu Sans Mono", false, true] ], "DejaVuSansMono-Oblique.ttf");
        expectTTFaces([ ["DejaVu Sans Mono", true, true] ], "DejaVuSansMono-BoldOblique.ttf");
        expectTTFaces([ ["DejaVu Serif"] ], "DejaVuSerif.ttf");
        expectTTFaces([ ["DejaVu Serif", true] ], "DejaVuSerif-Bold.ttf");

        expectTTFaces([
          ["Sitka Small"], ["Sitka Text"], ["Sitka Subheading"], ["Sitka Heading"], ["Sitka Display"], ["Sitka Banner"],
        ], "Sitka.ttc");
      });
    });
    
    describe("isEmbeddable", () => {
      function expectEmbeddable(expected: boolean, fontName: string): void {
        const fileName = IModelTestUtils.resolveFontFile(fontName);
        const fontFile = FontFile.createFromTrueTypeFileName(fileName);
        expect(fontFile.isEmbeddable).to.equal(expected);
      }

      it("prohibits embedding of restricted and preview-and-print faces", () => {
        expectEmbeddable(false, "Karla-Restricted.ttf");
        expectEmbeddable(false, "Karla-Preview-And-Print.ttf");

        expectEmbeddable(true, "Karla-Regular.ttf");

        expectEmbeddable(true, "DejaVuSansMono.ttf");
        expectEmbeddable(true, "Sitka-Banner.ttf");
      });

      it("prohibits embedding a file if any face is not embeddable", () => {
        expectEmbeddable(true, "Sitka.ttc");

        // ###TODO need a file with one face not embeddable
      });

      it("uses the least restrictive embedding rights if multiple bits are set", () => {
        expectEmbeddable(true, "Karla-MultipleEmbeddingRights.ttf");
      });
    });
  });
})

describe.only("FontFileImpl", () => {
  it("produces canonical keys from faces", () => {
    function expectKey(faces: IModelJsNative.FontFaceProps[], expected: string): void {
      const file = new CadFontFile(new Uint8Array(), FontType.Shx, faces);
      expect(file[_key]).to.equal(expected);
    }

    expectKey([{
      familyName: "Arial", faceName: "regular", subId: 1, type: FontType.Shx,
    }], `[{"familyName":"Arial","faceName":"regular","type":3,"subId":1}]`);

    expectKey([{
      subId: 1, faceName: "regular", type: FontType.Shx, familyName: "Arial",
    }], `[{"familyName":"Arial","faceName":"regular","type":3,"subId":1}]`);

    expectKey([{
      familyName: "Arial", faceName: "regular", subId: 2, type: FontType.Shx,
    }, {
      subId: 1, faceName: "regular", type: FontType.Shx, familyName: "Arial",
    }], `[{"familyName":"Arial","faceName":"regular","type":3,"subId":1},{"familyName":"Arial","faceName":"regular","type":3,"subId":2}]`);

    expectKey([{
      familyName: "Arial", faceName: "regular", subId: 2, type: FontType.Shx,
    }, {
      subId: 1, faceName: "bolditalic", type: FontType.Shx, familyName: "Arial",
    }, {
      familyName: "Arial", faceName: "bold", subId: 3, type: FontType.Shx,
    }], `[{"familyName":"Arial","faceName":"bold","type":3,"subId":3},{"familyName":"Arial","faceName":"bolditalic","type":3,"subId":1},{"familyName":"Arial","faceName":"regular","type":3,"subId":2}]`);

    expectKey([{
      familyName: "Consolas", faceName: "regular", subId: 1, type: FontType.Shx,
    }, {
      faceName: "italic", subId: 2, type: FontType.Shx, familyName: "Comic Sans",
    }, {
      familyName: "Arial", faceName: "regular", subId: 0, type: FontType.Shx,
    }], `[{"familyName":"Arial","faceName":"regular","type":3,"subId":0},{"familyName":"Comic Sans","faceName":"italic","type":3,"subId":2},{"familyName":"Consolas","faceName":"regular","type":3,"subId":1}]`);
  });
});
