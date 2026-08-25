/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as fs from "fs";
import * as sinon from "sinon";
import { StandaloneDb } from "../../IModelDb";
import { IModelTestUtils } from "../IModelTestUtils";
import { FontFace, FontType, RscFontEncodingProps } from "@itwin/core-common";
import { FontFile } from "../../FontFile";
import type { IModelJsNative } from "@bentley/imodeljs-native";
import { _faceProps, _getData } from "../../internal/Symbols";
import { CodeService } from "../../CodeService";
import { QueryMappedFamiliesArgs } from "../../IModelDbFonts";

describe("IModelDbFonts", () => {
  let db: StandaloneDb | undefined;

  class MockCodeService {
    public static enable = false;
    public static nextFaceDataId = 10;
    public static nextFontId = 100;

    public static reset() {
      this.enable = false;
      this.nextFaceDataId = 10;
      this.nextFontId = 100;
    }

    public static get internalCodes() {
      if (!MockCodeService.enable) {
        return undefined;
      }

      const obj = {
        reserveFontId: () => MockCodeService.nextFontId++,
        reserveEmbeddedFaceDataId: () => MockCodeService.nextFaceDataId++,
      };

      (obj as any).writeLocker = obj;
      return obj;
    }

    public static close() { }

  }

  beforeEach(async () => {
    CodeService.createForIModel = () => MockCodeService as any;
    db = StandaloneDb.createEmpty(
      IModelTestUtils.prepareOutputFile("IModelDbFonts", "IModelDbFontsTest.bim"),
      { rootSubject: { name: "IModelDbFontsTest" }, enableTransactions: true }
    );
    (db as any)._codeService = await CodeService.createForIModel(db);
  });

  afterEach(() => {
    if (db) {
      if (db.txns.hasLocalChanges)
        db.txns.deleteAllTxns();

      db.close();
      db = undefined;
    }

    MockCodeService.reset();
    CodeService.createForIModel = undefined;
  });

  function createTTFile(fontName: string): FontFile {
    return FontFile.createFromTrueTypeFileName(IModelTestUtils.resolveFontFile(fontName));
  }

  function createTTFace(familyName: string, faceName: "regular" | "bold" | "italic" | "bolditalic", subId = 0): IModelJsNative.FontFaceProps {
    return { familyName, faceName, type: FontType.TrueType, subId };
  }

  function getDb(): StandaloneDb {
    if (!db)
      throw new Error("Test iModel was not initialized");

    return db;
  }

  function expectEmbeddedFontFiles(expected: Array<IModelJsNative.FontFaceProps[]>) {
    const iModel = getDb();
    const fonts = Array.from(iModel.fonts.queryEmbeddedFontFiles());
    const actualFaceProps: Array<IModelJsNative.FontFaceProps[]> = fonts.map((x) => x[_faceProps]);

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
    it("embeds font files", async () => {
      expectEmbeddedFontFiles([]);

      const expectedFiles: Array<IModelJsNative.FontFaceProps[]> = [];

      async function embedAndTest(file: FontFile, expectedFaces: IModelJsNative.FontFaceProps[]): Promise<void> {
        const iModel = getDb();
        await iModel.fonts.embedFontFile({ file });
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

      await embedAndTest(createTTFile("Karla-Regular.ttf"), [createTTFace("Karla", "regular")]);

      await embedAndTest(createTTFile("Sitka.ttc"), [
        createTTFace("Sitka Banner", "regular", 5),
        createTTFace("Sitka Display", "regular", 4),
        createTTFace("Sitka Heading", "regular", 3),
        createTTFace("Sitka Small", "regular", 0),
        createTTFace("Sitka Subheading", "regular", 2),
        createTTFace("Sitka Text", "regular", 1),
      ]);

      await embedAndTest(createTTFile("DejaVuSans.ttf"), [createTTFace("DejaVu Sans", "regular")]);
      await embedAndTest(createTTFile("DejaVuSans-Bold.ttf"), [createTTFace("DejaVu Sans", "bold")]);

      const rscBlob = fs.readFileSync(IModelTestUtils.resolveFontFile("ENGINEERING.bin"));
      const encoding: RscFontEncodingProps = {
        degree: 5,
        plusMinus: 100,
      };
      await embedAndTest(FontFile.createFromRscFontBlob({ blob: rscBlob, familyName: "ENGINEERING", encoding }), [{
        familyName: "ENGINEERING",
        type: FontType.Rsc,
        faceName: "regular",
        subId: 0,
        encoding: {
          ...encoding,
          // omitted properties get default values
          diameter: 216,
          codePage: -1,
        }
      }]);
    });

    it("is a no-op if file is already embedded", async () => {
      const iModel = getDb();
      expectEmbeddedFontFiles([]);
      await iModel.fonts.embedFontFile({ file: createTTFile("Sitka.ttc") });
      expectEmbeddedFontFiles([[
        createTTFace("Sitka Banner", "regular", 5),
        createTTFace("Sitka Display", "regular", 4),
        createTTFace("Sitka Heading", "regular", 3),
        createTTFace("Sitka Small", "regular", 0),
        createTTFace("Sitka Subheading", "regular", 2),
        createTTFace("Sitka Text", "regular", 1),
      ]]);

      await iModel.fonts.embedFontFile({ file: createTTFile("Sitka.ttc") });
      expectEmbeddedFontFiles([[
        createTTFace("Sitka Banner", "regular", 5),
        createTTFace("Sitka Display", "regular", 4),
        createTTFace("Sitka Heading", "regular", 3),
        createTTFace("Sitka Small", "regular", 0),
        createTTFace("Sitka Subheading", "regular", 2),
        createTTFace("Sitka Text", "regular", 1),
      ]]);
    });

    it("throws if font is not embeddable", async () => {
      const iModel = getDb();
      await expect(iModel.fonts.embedFontFile({ file: createTTFile("Karla-Restricted.ttf") })).to.eventually.be.rejectedWith("Font does not permit embedding");
      await expect(iModel.fonts.embedFontFile({ file: createTTFile("Karla-Preview-And-Print.ttf") })).to.eventually.be.rejectedWith("Font does not permit embedding");
    });

    it("allocates font Ids unless otherwise specified", async () => {
      const iModel = getDb();
      await iModel.fonts.embedFontFile({ file: createTTFile("DejaVuSans.ttf") });
      expect(iModel.fonts.findId({ name: "DejaVu Sans", type: FontType.TrueType })).not.to.be.undefined;

      await iModel.fonts.embedFontFile({ file: createTTFile("Sitka.ttc"), skipFontIdAllocation: false });
      const sitkaFamilies = ["Banner", "Display", "Heading", "Small", "Subheading", "Text"].map((x) => `Sitka ${x}`);
      for (const name of sitkaFamilies) {
        expect(iModel.fonts.findId({ name, type: FontType.TrueType })).not.to.be.undefined;
      }

      await iModel.fonts.embedFontFile({ file: createTTFile("Karla-Regular.ttf"), skipFontIdAllocation: true });
      expect(iModel.fonts.findId({ name: "Karla", type: FontType.TrueType })).to.be.undefined;
    });

    it("requires schema lock if CodeService is not configured", async () => {
      const iModel = getDb();
      const spy = sinon.spy(iModel, "acquireSchemaLock");
      await iModel.fonts.embedFontFile({ file: createTTFile("Karla-Regular.ttf"), skipFontIdAllocation: true });
      expect(spy.callCount).to.equal(1);
      await iModel.fonts.embedFontFile({ file: createTTFile("Sitka.ttc"), skipFontIdAllocation: false });
      expect(spy.callCount).to.equal(2);
    });

    it("obtains face data Ids from CodeService if configured", async () => {
      const iModel = getDb();
      MockCodeService.enable = true;
      const spy = sinon.spy(iModel, "acquireSchemaLock");

      await iModel.fonts.embedFontFile({ file: createTTFile("Karla-Regular.ttf"), skipFontIdAllocation: true });

      await iModel.fonts.embedFontFile({ file: createTTFile("Sitka.ttc"), skipFontIdAllocation: false });

      expect(spy.callCount).to.equal(0);
      expect(MockCodeService.nextFaceDataId).to.equal(12);
    });

    it("round-trips font data", async () => {
      const iModel = getDb();
      const inputData = fs.readFileSync(IModelTestUtils.resolveFontFile("Cdm.shx"));
      await iModel.fonts.embedFontFile({ file: FontFile.createFromShxFontBlob({ blob: inputData, familyName: "Cdm" }) });

      const embeddedFiles = Array.from(iModel.fonts.queryEmbeddedFontFiles());
      expect(embeddedFiles.length).to.equal(1);
      const embeddedFile = embeddedFiles[0];

      const embeddedData = embeddedFile[_getData]();
      expect(Array.from(embeddedData)).to.deep.equal(Array.from(inputData));
    });
  });

  describe("acquireId", () => {
    it("assigns font Ids", async () => {
      const iModel = getDb();
      expect(iModel.fonts.findDescriptor(1)).to.be.undefined;

      const cdmShx = { name: "Cdm", type: FontType.Shx };
      expect(iModel.fonts.findId(cdmShx)).to.be.undefined;

      const cdmShxId = await iModel.fonts.acquireId(cdmShx);
      expect(cdmShxId).to.equal(1);

      const cdmShxId2 = await iModel.fonts.acquireId(cdmShx);
      expect(cdmShxId2).to.equal(cdmShxId);

      expect(iModel.fonts.findDescriptor(cdmShxId)).to.deep.equal(cdmShx);
      expect(iModel.fonts.findId(cdmShx)).to.equal(cdmShxId);

      const cdmRsc = { name: "Cdm", type: FontType.Rsc };
      expect(iModel.fonts.findId(cdmRsc)).to.be.undefined;

      const cdmRscId = await iModel.fonts.acquireId(cdmRsc);
      expect(cdmRscId).to.equal(2);

      expect(iModel.fonts.findId(cdmRsc)).to.equal(cdmRscId);
      expect(iModel.fonts.findDescriptor(cdmRscId)).to.deep.equal(cdmRsc);

      const arial = { name: "Arial", type: FontType.TrueType };
      const arialId = await iModel.fonts.acquireId(arial);
      expect(arialId).to.equal(3);
      expect(iModel.fonts.findId(arial)).to.equal(arialId);
      expect(iModel.fonts.findDescriptor(arialId)).to.deep.equal(arial);
    });

    it("requires schema lock if CodeService is not configured", async () => {
      const iModel = getDb();
      const spy = sinon.spy(iModel, "acquireSchemaLock");
      const cdmShx = { name: "Cdm", type: FontType.Shx };
      await iModel.fonts.acquireId(cdmShx);
      expect(spy.callCount).to.equal(1);

      await iModel.fonts.acquireId(cdmShx);
      expect(spy.callCount).to.equal(1);

      await iModel.fonts.acquireId({ name: "Arial", type: FontType.TrueType });
      expect(spy.callCount).to.equal(2);
    });

    it("acquires font Ids from CodeService if configured", async () => {
      const iModel = getDb();
      MockCodeService.enable = true;
      const spy = sinon.spy(iModel, "acquireSchemaLock");

      const cdmShx = { name: "Cdm", type: FontType.Shx };
      const cdmShxId = await iModel.fonts.acquireId(cdmShx);
      expect(cdmShxId).to.equal(100);

      const cdmShxId2 = await iModel.fonts.acquireId(cdmShx);
      expect(cdmShxId2).to.equal(cdmShxId);

      const arialId = await iModel.fonts.acquireId({ name: "Arial", type: FontType.TrueType });
      expect(arialId).to.equal(101);

      expect(spy.callCount).to.equal(0);
    });
  });

  describe("findId", () => {
    it("finds exact match by name and type, or first match by type if only name is supplied", async () => {
      const iModel = getDb();
      const shx = await iModel.fonts.acquireId({ name: "Font", type: FontType.Shx });
      expect(iModel.fonts.findId({ name: "Font", type: FontType.Shx })).to.equal(shx);
      expect(iModel.fonts.findId({ name: "Font", type: FontType.Rsc })).to.be.undefined;
      expect(iModel.fonts.findId({ name: "Font", type: FontType.TrueType })).to.be.undefined;
      expect(iModel.fonts.findId({ name: "Font" })).to.equal(shx);

      const tt = await iModel.fonts.acquireId({ name: "Font", type: FontType.TrueType });
      expect(iModel.fonts.findId({ name: "Font", type: FontType.TrueType })).to.equal(tt);
      expect(iModel.fonts.findId({ name: "Font", type: FontType.Rsc })).to.be.undefined;
      expect(iModel.fonts.findId({ name: "Font", type: FontType.Shx })).to.equal(shx);
      expect(iModel.fonts.findId({ name: "Font" })).to.equal(tt);

      const rsc = await iModel.fonts.acquireId({ name: "Font", type: FontType.Rsc });
      expect(iModel.fonts.findId({ name: "Font", type: FontType.Rsc })).to.equal(rsc);
      expect(iModel.fonts.findId({ name: "Font", type: FontType.TrueType })).to.equal(tt);
      expect(iModel.fonts.findId({ name: "Font", type: FontType.Shx })).to.equal(shx);
      expect(iModel.fonts.findId({ name: "Font" })).to.equal(tt);
    });
  });

  describe("queryMappedFamilies", () => {
    it("omits entries with no embedded face data by default", async () => {
      const iModel = getDb();
      await iModel.fonts.embedFontFile({ file: createTTFile("Karla-Regular.ttf") });
      await iModel.fonts.embedFontFile({ file: createTTFile("DejaVuSans.ttf"), skipFontIdAllocation: true });
      await iModel.fonts.acquireId({ name: "Arial", type: FontType.TrueType });

      function expectFamilies(expected: string[], args?: QueryMappedFamiliesArgs): void {
        const actual = Array.from(iModel.fonts.queryMappedFamilies(args)).map((x) => x.name).sort();
        expect(actual).to.deep.equal(expected.sort());
      }

      expectFamilies(["Karla"]);
      expectFamilies(["Karla"], { includeNonEmbedded: false })
      expectFamilies(["Arial", "Karla"], { includeNonEmbedded: true });
    });
  });
});
