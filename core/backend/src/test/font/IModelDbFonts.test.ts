/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as fs from "fs";
import * as sinon from "sinon";
import { IModelTestUtils } from "../IModelTestUtils";
import { ShxFontFile, TrueTypeFontFile } from "../../Font";
import { FontType } from "@itwin/core-common";
import { StandaloneDb } from "../../IModelDb";
import { DbResult, Guid } from "@itwin/core-bentley";
import type { IModelJsNative } from "@bentley/imodeljs-native";

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

  function queryEmbeddedFonts(): Array<IModelJsNative.FontFaceProps[]> {
    const result: Array<IModelJsNative.FontFaceProps[]> = [];
    db.withPreparedSqliteStatement("select StrData from be_Prop where namespace='dgn_Font' and name='EmbeddedFaceData'", (stmt) => {
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        result.push(JSON.parse(stmt.getValueString(0)) as IModelJsNative.FontFaceProps[]);
      }
    });

    return result;
  }

  function expectFamilyNames(expected: string[]): void {
    expected.sort();
    const actual = Array.from(db.fonts.embeddedFontNames).sort();
    expect(actual).to.deep.equal(expected);
  }

  describe("embedFile", () => {
    it("throws if file is not writable", async () => {
      
    });
  
    it("embeds SHX fonts", async () => {
      expect(queryEmbeddedFonts().length).to.equal(0);
      
      const fileName = IModelTestUtils.resolveFontFile("Cdm.shx");
      const blob = fs.readFileSync(fileName);
      const font = ShxFontFile.fromBlob({ blob, familyName: "Cdm" });
      await db.fonts.embedFile(font);

      const fonts = queryEmbeddedFonts();
      expect(fonts.length).to.equal(1);
      expect(fonts[0].length).to.equal(1);
      expect(fonts[0][0]).to.deep.equal({
        familyName: "Cdm",
        type: FontType.Shx,
        faceName: "regular",
        subId: 0,
      });

      expectFamilyNames(["Cdm"]);
    });

    function createTTFont(name: string): TrueTypeFontFile {
      return TrueTypeFontFile.fromFileName(IModelTestUtils.resolveFontFile(name));
    }

    it("embeds TrueType fonts", async () => {
      expect(queryEmbeddedFonts().length).to.equal(0);

      await db.fonts.embedFile(createTTFont("Karla-Regular.ttf"));
      expect(queryEmbeddedFonts().length).to.equal(1);

      await db.fonts.embedFile(createTTFont("Sitka.ttc"));
      expect(queryEmbeddedFonts().length).to.equal(2);

      await db.fonts.embedFile(createTTFont("DejaVuSans.ttf"));
      expect(queryEmbeddedFonts().length).to.equal(3);
      await db.fonts.embedFile(createTTFont("DejaVuSans-Bold.ttf"));
      expect(queryEmbeddedFonts().length).to.equal(4);
      
      expectFamilyNames([
        "DejaVu Sans",
        "Karla",
        "Sitka Banner", "Sitka Display", "Sitka Heading", "Sitka Small", "Sitka Subheading", "Sitka Text",
      ]);

      function makeFace(familyName: string, faceName: "regular" | "bold" | "italic" | "bolditalic", subId: number): IModelJsNative.FontFaceProps {
        return { familyName, faceName, subId, type: FontType.TrueType };
      }

      const compareFaces = (a: IModelJsNative.FontFaceProps, b: IModelJsNative.FontFaceProps) => a.familyName.localeCompare(b.familyName) || a.faceName.localeCompare(b.faceName) || a.type - b.type;
      const expectedFaces: IModelJsNative.FontFaceProps[] = [
        makeFace("DejaVu Sans", "bold", 0), makeFace("DejaVu Sans", "regular", 0),
        makeFace("Karla", "regular", 0),
        makeFace("Sitka Banner", "regular", 5), makeFace("Sitka Display", "regular", 4), makeFace("Sitka Heading", "regular", 3),
        makeFace("Sitka Small", "regular", 0), makeFace("Sitka Subheading", "regular", 2), makeFace("Sitka Text", "regular", 1),
      ].sort(compareFaces);

      const actualFaces = queryEmbeddedFonts().flat().sort(compareFaces);
      expect(actualFaces).to.deep.equal(expectedFaces);
    });

    it("throws attempting to embed a font without embedding rights", async () => {
      expect(db.fonts.embedFile(createTTFont("Karla-Restricted.ttf"))).to.eventually.be.rejectedWith("Font does not permit embedding");
      expect(db.fonts.embedFile(createTTFont("Karla-Preview-And-Print.ttf"))).to.eventually.be.rejectedWith("Font does not permit embedding");
      expect(queryEmbeddedFonts().length).to.equal(0);

      await db.fonts.embedFile(createTTFont("Karla-MultipleEmbeddingRights.ttf"));
      expect(queryEmbeddedFonts().length).to.equal(1);
      expect(Array.from(db.fonts.embeddedFontNames)).to.deep.equal(["Karla"]);
    });

    it("throws if file is already embedded", async () => {
      // ###TODO
    });

    it("requires schema lock", async () => {
      const spy = sinon.spy(db, "acquireSchemaLock");
      await db.fonts.embedFile(createTTFont("Karla-Regular.ttf"));
      expect(spy.callCount).to.equal(1);
      await db.fonts.embedFile(createTTFont("Sitka.ttc"));
      expect(spy.callCount).to.equal(2);
    });
  });
});

