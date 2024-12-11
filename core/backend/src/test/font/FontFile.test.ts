/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import { expect } from "chai";
import { FontFace, FontType } from "@itwin/core-common";
import { IModelTestUtils } from "../IModelTestUtils";
import { FontFile } from "../../FontFile";

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
})
