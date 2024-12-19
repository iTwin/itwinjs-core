/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as fs from "fs";
import * as sinon from "sinon";
import { BriefcaseDb, IModelDb } from "../../IModelDb";
import { IModelTestUtils } from "../IModelTestUtils";
import { FontFace, FontType, RscFontEncodingProps } from "@itwin/core-common";
import { FontFile } from "../../FontFile";
import type { IModelJsNative } from "@bentley/imodeljs-native";
import { _faceProps, _getData } from "../../internal/Symbols";
import { CodeService } from "../../CodeService";
import { HubMock } from "../../HubMock";
import { KnownTestLocations } from "../KnownTestLocations";
import { BriefcaseManager } from "../../BriefcaseManager";

describe("IModelDbFonts", () => {
  let db: IModelDb;

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

  before(() => HubMock.startup("IModelDbFontsTest", KnownTestLocations.outputDir));
  after(() => HubMock.shutdown());

  beforeEach(async () => {
    CodeService.createForIModel = () => MockCodeService as any;
    const iModelId = await HubMock.createNewIModel({ iModelName: "IModelDbFontsTest", iTwinId: HubMock.iTwinId });
    const bcProps = await BriefcaseManager.downloadBriefcase({ accessToken: "test", iTwinId: HubMock.iTwinId, iModelId });
    db = await BriefcaseDb.open({ fileName: bcProps.fileName});
  });

  afterEach(() => {
    db.abandonChanges();
    db.close();
    MockCodeService.reset();
    CodeService.createForIModel = undefined;
  });

  function createTTFile(fontName: string): FontFile {
    return FontFile.createFromTrueTypeFileName(IModelTestUtils.resolveFontFile(fontName));
  }

  function createTTFace(familyName: string, faceName: "regular" | "bold" | "italic" | "bolditalic", subId = 0): IModelJsNative.FontFaceProps {
    return { familyName, faceName, type: FontType.TrueType, subId };
  }

  function expectEmbeddedFontFiles(expected: Array<IModelJsNative.FontFaceProps[]>) {
    const fonts = Array.from(db.fonts.queryEmbeddedFontFiles());
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
      expectEmbeddedFontFiles([]);
      await db.fonts.embedFontFile({ file: createTTFile("Sitka.ttc") });
      expectEmbeddedFontFiles([[
        createTTFace("Sitka Banner", "regular", 5),
        createTTFace("Sitka Display", "regular", 4),
        createTTFace("Sitka Heading", "regular", 3),
        createTTFace("Sitka Small", "regular", 0),
        createTTFace("Sitka Subheading", "regular", 2),
        createTTFace("Sitka Text", "regular", 1),
      ]]);

      await db.fonts.embedFontFile({ file: createTTFile("Sitka.ttc") });
      expectEmbeddedFontFiles([[
        createTTFace("Sitka Banner", "regular", 5),
        createTTFace("Sitka Display", "regular", 4),
        createTTFace("Sitka Heading", "regular", 3),
        createTTFace("Sitka Small", "regular", 0),
        createTTFace("Sitka Subheading", "regular", 2),
        createTTFace("Sitka Text", "regular", 1),
      ]]);
    });

    it("throws if file is read-only", async () => {
      // ###TODO
    });

    it("throws if font is not embeddable", async () => {
      await expect(db.fonts.embedFontFile({ file: createTTFile("Karla-Restricted.ttf") })).to.eventually.be.rejectedWith("Font does not permit embedding");
      await expect(db.fonts.embedFontFile({ file: createTTFile("Karla-Preview-And-Print.ttf") })).to.eventually.be.rejectedWith("Font does not permit embedding");
    });

    it("allocates font Ids unless otherwise specified", async () => {
      await db.fonts.embedFontFile({ file: createTTFile("DejaVuSans.ttf") });
      expect(db.fonts.findId({ name: "DejaVu Sans", type: FontType.TrueType })).not.to.be.undefined;

      await db.fonts.embedFontFile({ file: createTTFile("Sitka.ttc"), dontAllocateFontIds: false });
      const sitkaFamilies = ["Banner", "Display", "Heading", "Small", "Subheading", "Text"].map((x) => `Sitka ${x}`);
      for (const name of sitkaFamilies) {
        expect(db.fonts.findId({ name, type: FontType.TrueType })).not.to.be.undefined;
      }

      await db.fonts.embedFontFile({ file: createTTFile("Karla-Regular.ttf"), dontAllocateFontIds: true });
      expect(db.fonts.findId({ name: "Karla", type: FontType.TrueType })).to.be.undefined;
    });

    it("requires schema lock if CodeService is not configured", async () => {
      const spy = sinon.spy(db, "acquireSchemaLock");
      await db.fonts.embedFontFile({ file: createTTFile("Karla-Regular.ttf"), dontAllocateFontIds: true });
      expect(spy.callCount).to.equal(1);
      await db.fonts.embedFontFile({ file: createTTFile("Sitka.ttc"), dontAllocateFontIds: false });
      expect(spy.callCount).to.equal(2);
    });

    it("obtains face data Ids from CodeService if configured", async () => {
      MockCodeService.enable = true;
      const spy = sinon.spy(db, "acquireSchemaLock");

      await db.fonts.embedFontFile({ file: createTTFile("Karla-Regular.ttf"), dontAllocateFontIds: true });
      
      await db.fonts.embedFontFile({ file: createTTFile("Sitka.ttc"), dontAllocateFontIds: false });

      expect(spy.callCount).to.equal(0);
      expect(MockCodeService.nextFaceDataId).to.equal(12);
    });

    it("round-trips font data", async () => {
      const inputData = fs.readFileSync(IModelTestUtils.resolveFontFile("Cdm.shx"));
      await db.fonts.embedFontFile({ file: FontFile.createFromShxFontBlob({ blob: inputData, familyName: "Cdm" }) });

      const embeddedFiles = Array.from(db.fonts.queryEmbeddedFontFiles());
      expect(embeddedFiles.length).to.equal(1);
      const embeddedFile = embeddedFiles[0];

      const embeddedData = embeddedFile[_getData]();
      expect(Array.from(embeddedData)).to.deep.equal(Array.from(inputData));
    });
  });

  describe("acquireId", () => {
    it("assigns font Ids", async () => {
      expect(db.fonts.findDescriptor(1)).to.be.undefined;

      const cdmShx = { name: "Cdm", type: FontType.Shx };
      expect(db.fonts.findId(cdmShx)).to.be.undefined;

      const cdmShxId = await db.fonts.acquireId(cdmShx);
      expect(cdmShxId).to.equal(1);

      const cdmShxId2 = await db.fonts.acquireId(cdmShx);
      expect(cdmShxId2).to.equal(cdmShxId);

      expect(db.fonts.findDescriptor(cdmShxId)).to.deep.equal(cdmShx);
      expect(db.fonts.findId(cdmShx)).to.equal(cdmShxId);

      const cdmRsc = { name: "Cdm", type: FontType.Rsc };
      expect(db.fonts.findId(cdmRsc)).to.be.undefined;

      const cdmRscId = await db.fonts.acquireId(cdmRsc);
      expect(cdmRscId).to.equal(2);
    
      expect(db.fonts.findId(cdmRsc)).to.equal(cdmRscId);
      expect(db.fonts.findDescriptor(cdmRscId)).to.deep.equal(cdmRsc);

      const arial = { name: "Arial", type: FontType.TrueType };
      const arialId = await db.fonts.acquireId(arial);
      expect(arialId).to.equal(3);
      expect(db.fonts.findId(arial)).to.equal(arialId);
      expect(db.fonts.findDescriptor(arialId)).to.deep.equal(arial);
    });

    it("requires schema lock if CodeService is not configured", async () => {
      const spy = sinon.spy(db, "acquireSchemaLock");
      const cdmShx = { name: "Cdm", type: FontType.Shx };
      await db.fonts.acquireId(cdmShx);
      expect(spy.callCount).to.equal(1);

      await db.fonts.acquireId(cdmShx);
      expect(spy.callCount).to.equal(1);

      await db.fonts.acquireId({ name: "Arial", type: FontType.TrueType });
      expect(spy.callCount).to.equal(2);
    });

    it("acquires font Ids from CodeService if configured", async () => {
      MockCodeService.enable = true;
      const spy = sinon.spy(db, "acquireSchemaLock");

      const cdmShx = { name: "Cdm", type: FontType.Shx };
      const cdmShxId = await db.fonts.acquireId(cdmShx);
      expect(cdmShxId).to.equal(100);

      const cdmShxId2 = await db.fonts.acquireId(cdmShx);
      expect(cdmShxId2).to.equal(cdmShxId);

      const arialId = await db.fonts.acquireId({ name: "Arial", type: FontType.TrueType });
      expect(arialId).to.equal(101);

      expect(spy.callCount).to.equal(0);
    });
  });
  
  describe("findId", () => {
    it("finds exact match by name and type, or first match by type if only name is supplied", async () => {
      const shx = await db.fonts.acquireId({ name: "Font", type: FontType.Shx });
      expect(db.fonts.findId({ name: "Font", type: FontType.Shx })).to.equal(shx);
      expect(db.fonts.findId({ name: "Font", type: FontType.Rsc})).to.be.undefined;
      expect(db.fonts.findId({ name: "Font", type: FontType.TrueType})).to.be.undefined;
      expect(db.fonts.findId({ name: "Font" })).to.equal(shx);
      
      const tt = await db.fonts.acquireId({ name: "Font", type: FontType.TrueType });
      expect(db.fonts.findId({ name: "Font", type: FontType.TrueType })).to.equal(tt);
      expect(db.fonts.findId({ name: "Font", type: FontType.Rsc})).to.be.undefined;
      expect(db.fonts.findId({ name: "Font", type: FontType.Shx})).to.equal(shx);
      expect(db.fonts.findId({ name: "Font" })).to.equal(tt);

      const rsc = await db.fonts.acquireId({ name: "Font", type: FontType.Rsc });
      expect(db.fonts.findId({ name: "Font", type: FontType.Rsc})).to.equal(rsc);
      expect(db.fonts.findId({ name: "Font", type: FontType.TrueType })).to.equal(tt);
      expect(db.fonts.findId({ name: "Font", type: FontType.Shx})).to.equal(shx);
      expect(db.fonts.findId({ name: "Font" })).to.equal(tt);
    });
  });

  it("queries font data", async () => {
    // ###TODO
  });
});
