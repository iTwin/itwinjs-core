/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as fs from "fs";
import { StandaloneDb } from "../../IModelDb";
import { IModelTestUtils } from "../IModelTestUtils";
import { DbResult, Guid } from "@itwin/core-bentley";
import { FontFace } from "@itwin/core-common";
import { FontFile } from "../../FontFile";
import { FontType } from "@itwin/core-common";
import type { IModelJsNative } from "@bentley/imodeljs-native";
import { FontFileImpl } from "../../internal/FontFileImpl";

describe.only("IModelDbFonts", () => {
  let db: StandaloneDb;

  beforeEach(() => {
    db = StandaloneDb.createEmpty(IModelTestUtils.prepareOutputFile("IModelDbFonts", "IModelDbFonts.bim"), {
      rootSubject: { name: "IModelDbFonts tests", description: "IModelDbFonts tests" },
      client: "IModelDbFonts",
      globalOrigin: { x: 0, y: 0 },
      projectExtents: { low: { x: -500, y: -500, z: -50 }, high: { x: 500, y: 500, z: 50 } },
      guid: Guid.createValue(),
    });
  });

  afterEach(() => {
    db.close();
  });

  function createTTFile(fontName: string): FontFile {
    return FontFile.createFromTrueTypeFileName(IModelTestUtils.resolveFontFile(fontName));
  }

  function expectEmbeddedFontFiles(expected: Array<IModelJsNative.FontFaceProps[]>) {
    const fonts = Array.from(db.fonts.queryEmbeddedFontFiles());
    const actualFaceProps: Array<IModelJsNative.FontFaceProps[]> = fonts.map((x) => {
      expect(x instanceof FontFileImpl).to.be.true;
      return (x as FontFileImpl).faceProps;
    });

    expect(actualFaceProps).to.deep.equal(expected);

    const expectedFaces: Array<FontFace[]> = expected.map((list) => {
      return list.map((x) => {
        return {
          familyName: x.familyName,
          isBold: x.faceName.startsWith("bold"),
          isItalic: x.faceName.endsWith("italic"),
        };
      });
    });

    const actualFaces = fonts.map((x) => x.faces);
    expect(actualFaces).to.deep.equal(expectedFaces);
  }

  describe("embedFontFile", () => {
    it.only("embeds font files", async () => {
      expectEmbeddedFontFiles([]);

      const expectedFiles: Array<IModelJsNative.FontFaceProps[]> = [];
  
      async function embedAndTest(file: FontFile, expectedFaces: IModelJsNative.FontFaceProps[]): Promise<void> {
        await db.fonts.embedFontFile({ file });
        expectedFiles.push(expectedFaces);
        expectEmbeddedFontFiles(expectedFiles);
      }

      const fileName = IModelTestUtils.resolveFontFile("Cdm.shx");
      const blob = fs.readFileSync(fileName);
      await embedAndTest(FontFile.createFromShxFontBlob({ blob, familyName: "Cdm" }), [{
        familyName: "Cdm",
        type: FontType.Shx,
        faceName: "regular",
        subId: 0,
      }]);

    });

    it("is a no-op if file is already embedded", async () => {
      
    });

    it("throws if file is read-only", async () => {
      
    });

    it("throws if font is not embeddable", async () => {
      
    });

    it("allocates font Ids unless otherwise specified", async () => {
      
    });

    it("requires schema lock if CodeService is not configured", async () => {
      
    });

    it("assigns sequential Ids in be_Prop table", async () => {
      
    });
  });
});
