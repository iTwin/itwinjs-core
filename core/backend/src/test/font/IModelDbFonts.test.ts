/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as fs from "fs";
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

  describe("embedFile", () => {
    it("embeds SHX fonts", () => {
      expect(queryEmbeddedFonts().length).to.equal(0);
      
      const fileName = IModelTestUtils.resolveFontFile("Cdm.shx");
      const blob = fs.readFileSync(fileName);
      const font = ShxFontFile.fromBlob({ blob, familyName: "Cdm" });
      db.fonts.embedFile(font);

      const fonts = queryEmbeddedFonts();
      expect(fonts.length).to.equal(1);
      expect(fonts[0].length).to.equal(1);
      expect(fonts[0][0]).to.deep.equal({
        familyName: "Cdm",
        type: FontType.Shx,
        faceName: "regular",
        subId: 0,
      });
    });

    it("embeds TrueType fonts", () => {
    
    });
  });
});

