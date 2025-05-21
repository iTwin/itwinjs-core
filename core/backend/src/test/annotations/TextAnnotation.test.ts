/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { Angle, Point3d, Range2d, YawPitchRollAngles } from "@itwin/core-geometry";
import { Code, ElementProps, FractionRun, GeometricModel2dProps, RelatedElement, SubCategoryAppearance, TextAnnotation, TextAnnotation2dProps, TextAnnotation3dProps, TextBlock, TextRun } from "@itwin/core-common";
import { IModelDb, SnapshotDb, StandaloneDb } from "../../IModelDb";
import { TextAnnotation2d, TextAnnotation3d } from "../../annotations/TextAnnotationElement";
import { IModelTestUtils } from "../IModelTestUtils";
import { DocumentPartition, Drawing, GeometricElement2d, GeometricElement3d, Subject } from "../../Element";
import { Guid, Id64, Id64String } from "@itwin/core-bentley";
import { ComputeRangesForTextLayoutArgs, TextLayoutRanges } from "../../annotations/TextBlockLayout";
import { DefinitionModel, DocumentListModel, DrawingModel } from "../../Model";
import { DrawingCategory } from "../../Category";
import { DisplayStyle2d } from "../../DisplayStyle";
import { CategorySelector, DrawingViewDefinition } from "../../ViewDefinition";
import { FontFile } from "../../FontFile";

function computeTextRangeAsStringLength(args: ComputeRangesForTextLayoutArgs): TextLayoutRanges {
  const range = new Range2d(0, 0, args.chars.length, args.lineHeight);
  return { layout: range, justification: range };
}

function mockIModel(): IModelDb {
  const iModel: Pick<IModelDb, "fonts" | "computeRangesForText" | "forEachMetaData"> = {
    fonts: {
      findId: () => 0,
    } as any,
    computeRangesForText: computeTextRangeAsStringLength,
    forEachMetaData: () => undefined,
  };

  return iModel as IModelDb;
}

describe("TextAnnotation element", () => {
  function makeElement(props?: Partial<TextAnnotation2dProps>): TextAnnotation2d {
    return TextAnnotation2d.fromJSON({
      category: "0x12",
      model: "0x34",
      code: {
        spec: "0x56",
        scope: "0x78",
      },
      classFullName: TextAnnotation2d.classFullName,
      placement: {
        origin: { x: 0, y: 0 },
        angle: 0,
      },
      ...props,
    }, mockIModel());
  }

  describe("getAnnotation", () => {
    it("returns undefined if not present in JSON properties", () => {
      expect(makeElement().getAnnotation()).to.be.undefined;
    });

    it("extracts from JSON properties", () => {
      const elem = makeElement({
        jsonProperties: {
          annotation: {
            textBlock: TextBlock.create({ styleName: "block" }).toJSON(),
          },
        },
      });

      const anno = elem.getAnnotation()!;
      expect(anno).not.to.be.undefined;
      expect(anno.textBlock.isEmpty).to.be.true;
      expect(anno.textBlock.styleName).to.equal("block");
    });

    it("produces a new object each time it is called", () => {
      const elem = makeElement({
        jsonProperties: {
          annotation: {
            textBlock: TextBlock.create({ styleName: "block" }).toJSON(),
          },
        },
      });

      const anno1 = elem.getAnnotation()!;
      const anno2 = elem.getAnnotation()!;
      expect(anno1).not.to.equal(anno2);
      expect(anno1.textBlock.equals(anno2.textBlock)).to.be.true;
    });
  });

  describe("setAnnotation", () => {
    it("updates JSON properties", () => {
      const elem = makeElement();

      const textBlock = TextBlock.create({ styleName: "block" });
      textBlock.appendRun(TextRun.create({ content: "text", styleName: "run" }));
      const annotation = TextAnnotation.fromJSON({ textBlock: textBlock.toJSON() });
      elem.setAnnotation(annotation);

      expect(elem.jsonProperties.annotation).to.deep.equal(annotation.toJSON());
      expect(elem.jsonProperties.annotation).not.to.equal(annotation.toJSON());
    });

    // it("uses default subcategory by default", () => {
    //   const elem = makeElement();
    //   elem.setAnnotation(TextAnnotation.fromJSON({ textBlock: { styleName: "block" } }));
    //   expect(elem.geom!.length).to.equal(1);
    //   expect(elem.geom![0].appearance!.subCategory).to.equal("0x13");
    // });

    // it("uses specific subcategory if provided", () => {
    //   const elem = makeElement();
    //   elem.setAnnotation(TextAnnotation.fromJSON({ textBlock: { styleName: "block" } }));
    //   expect(elem.geom!.length).to.equal(1);
    //   expect(elem.geom![0].appearance!.subCategory).to.equal("0x1234");
    // });
  });

  function createAnnotation(): TextAnnotation {

    const styleOverrides = { fontName: "Karla" };
    const block = TextBlock.create({ styleName: "block", styleOverrides });
    block.appendRun(TextRun.create({ content: "Run, Barry,", styleName: "run1", styleOverrides }));
    block.appendRun(TextRun.create({ content: "RUN!!!", styleName: "run2", styleOverrides }));
    block.appendRun(FractionRun.create({ numerator: "Harrison", denominator: "Wells", styleName: "run3", styleOverrides }));

    const annotation = TextAnnotation.fromJSON({ textBlock: block.toJSON() });
    annotation.anchor = { vertical: "middle", horizontal: "right" };
    annotation.orientation = YawPitchRollAngles.createDegrees(1, 0, -1);
    annotation.offset = Point3d.create(0, -5, 100);
    annotation.frame = { shape: "none" };

    return annotation;
  }

  const getOrCreateDocumentList = async (db: IModelDb): Promise<Id64String> => {
    const documentListName = "DrawingModel";
    let documentListModelId: string | undefined;

    // Attempt to find an existing document partition and document list model
    const ids = db.queryEntityIds({ from: DocumentPartition.classFullName, where: `CodeValue = '${documentListName}'` });
    if (ids.size === 1) {
      documentListModelId = ids.values().next().value;
    }

    // If they do not exist, create the document partition and document list model
    if (documentListModelId === undefined) {
      const subjectId = db.elements.getRootSubject().id;
      await db.locks.acquireLocks({
        shared: subjectId,
      });
      documentListModelId = DocumentListModel.insert(db, subjectId, documentListName);
    }


    return documentListModelId;
  };

  const insertDrawingElement = async (db: IModelDb, drawingName: string): Promise<Id64String> => {
    // Get or make documentListModelId
    const documentListModelId = await getOrCreateDocumentList(db);

    // Acquire locks and create sheet
    await db.locks.acquireLocks({ shared: documentListModelId });
    const drawingElementProps: ElementProps = {
      classFullName: Drawing.classFullName,
      code: Drawing.createCode(db, documentListModelId, drawingName),
      model: documentListModelId
    };
    return db.elements.insertElement(drawingElementProps);
  };

  const insertDrawingModel = async (db: IModelDb, drawingElementId: string): Promise<Id64String> => {
    const drawingModelProps: GeometricModel2dProps = {
      classFullName: DrawingModel.classFullName,
      modeledElement: { id: drawingElementId, relClassName: "BisCore:ModelModelsElement" } as RelatedElement,
    };
    return db.models.insertModel(drawingModelProps);
  };

  const createJobSubjectElement = (iModel: IModelDb, name: string): Subject => {
    const subj = Subject.create(iModel, iModel.elements.getRootSubject().id, name);
    subj.setJsonProperty("Subject", { Job: name }); // eslint-disable-line @typescript-eslint/naming-convention

    return subj;
  }

  const insertModels = async (standaloneModel: StandaloneDb) => {
    const jobSubjectId = createJobSubjectElement(standaloneModel, "Job").insert();
    const drawingDefinitionModelId = DefinitionModel.insert(standaloneModel, jobSubjectId, "DrawingDefinition");
    const drawingCategoryId = DrawingCategory.insert(standaloneModel, drawingDefinitionModelId, "DrawingCategory", new SubCategoryAppearance());
    const drawingElementId = await insertDrawingElement(standaloneModel, "drawing-1");
    const drawingModelId = await insertDrawingModel(standaloneModel, drawingElementId);

    const displayStyle2dId = DisplayStyle2d.insert(standaloneModel, drawingDefinitionModelId, "DisplayStyle2d");
    const drawingCategorySelectorId = CategorySelector.insert(standaloneModel, drawingDefinitionModelId, "DrawingCategories", [drawingCategoryId]);
    const drawingViewRange = new Range2d(0, 0, 500, 500);
    const drawingViewId = DrawingViewDefinition.insert(standaloneModel, drawingDefinitionModelId, "Drawing View", drawingModelId, drawingCategorySelectorId, displayStyle2dId, drawingViewRange);

    const drawing = {
      definitionModel: drawingDefinitionModelId,
      category: drawingCategoryId,
      element: drawingElementId,
      model: drawingModelId,
      displayStyle: displayStyle2dId,
      categorySelector: drawingCategorySelectorId,
      view: drawingViewId,
    }

    return { drawing };
  }


  describe.only("TextAnnotation3d Persistence", () => {
    let imodel: SnapshotDb;
    let seed: GeometricElement3d;

    before(() => {
      const seedFileName = IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim");
      const testFileName = IModelTestUtils.prepareOutputFile("GeometryStream", "GeometryStreamTest.bim");
      imodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);

      seed = imodel.elements.getElement<GeometricElement3d>("0x1d");
      assert.exists(seed);
      assert.isTrue(seed.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");
    });

    after(() => imodel.close());

    function createElement3d(props?: Partial<TextAnnotation3dProps>): TextAnnotation3d {
      return TextAnnotation3d.fromJSON({
        category: seed.category,
        model: seed.model,
        code: {
          spec: seed.code.spec,
          scope: seed.code.scope,
        },
        placement: {
          origin: { x: 0, y: 0, z: 0 },
          angles: YawPitchRollAngles.createDegrees(0, 0, 0).toJSON(),
        },
        ...props,
        classFullName: TextAnnotation3d.classFullName,
      }, imodel);
    }

    it("create method does not automatically compute the geometry", () => {
      const annotation = createAnnotation();
      const el = createElement3d({ jsonProperties: { annotation: annotation.toJSON() } });
      expect(el.getAnnotation()!.equals(annotation)).to.be.true;
      expect(el.geom).to.be.undefined;
    });

    function expectPlacement(el: GeometricElement3d, expectValidBBox: boolean, expectedOrigin = [0, 0, 0], expectedYPR = [0, 0, 0]): void {
      expect(el.placement.origin.x).to.equal(expectedOrigin[0]);
      expect(el.placement.origin.y).to.equal(expectedOrigin[1]);
      expect(el.placement.origin.z).to.equal(expectedOrigin[2]);
      expect(el.placement.angles.yaw.radians).to.equal(expectedYPR[0]);
      expect(el.placement.angles.pitch.radians).to.equal(expectedYPR[1]);
      expect(el.placement.angles.roll.radians).to.equal(expectedYPR[2]);
      expect(el.placement.bbox.isNull).to.equal(!expectValidBBox);
    }

    describe("inserts 3d element and round-trips through JSON", async () => {
      async function test(annotation?: TextAnnotation): Promise<void> {
        const el0 = createElement3d();
        if (annotation) {
          el0.setAnnotation(annotation);
        }

        expectPlacement(el0, false);
        expect(el0.toJSON().elementGeometryBuilderParams).not.to.be.undefined;


        const elId = el0.insert()

        expect(Id64.isValidId64(elId)).to.be.true;

        const el1 = imodel.elements.getElement<TextAnnotation3d>(elId);
        expect(el1).not.to.be.undefined;
        expect(el1 instanceof TextAnnotation3d).to.be.true;

        expectPlacement(el1, undefined !== annotation && !annotation.textBlock.isEmpty);

        const anno = el1.getAnnotation();

        if (!annotation) {
          expect(anno, "If no annotation was provided, none should have been inserted to the JSON properties").to.be.undefined;
        } else {
          expect(anno).not.to.be.undefined;
          expect(anno!.equals(annotation)).to.be.true;
        }
      }

      it("roundtrips an empty annotation", async () => { await test(); });
      it("roundtrips an annotation with a style", async () => { await test(TextAnnotation.fromJSON({ textBlock: { styleName: "block" } })); });
      it("roundtrips an annotation with a textBlock", async () => { await test(createAnnotation()); });
    });
  });
  describe.only("TextAnnotation2d Persistence", () => {
    let imodel: StandaloneDb;
    let seedCategoryId: string;
    let seedModelId: string;

    before(async () => {
      const filePath = IModelTestUtils.prepareOutputFile("annotationTests", "TextAnnotation2d.bim");
      imodel = StandaloneDb.createEmpty(filePath, {
        rootSubject: { name: "TextAnnotation2d tests", description: "TextAnnotation2d tests" },
        client: "integration tests",
        globalOrigin: { x: 0, y: 0 },
        projectExtents: { low: { x: -500, y: -500, z: -50 }, high: { x: 500, y: 500, z: 50 } },
        guid: Guid.createValue(),
      });

      const ids = await insertModels(imodel);
      await imodel.fonts.embedFontFile({
        file: FontFile.createFromTrueTypeFileName(IModelTestUtils.resolveFontFile("Karla-Regular.ttf"))
      })

      expect(ids.drawing).not.to.be.undefined;
      Object.entries(ids.drawing).forEach((entry => { expect(entry[1], `expected ${entry[0]} to be defined`).not.to.be.undefined; }));


      seedCategoryId = ids.drawing.category;
      seedModelId = ids.drawing.model;
    });

    after(() => {
      imodel.saveChanges("tests");
      imodel.close();
    });

    function createElement2d(props?: Partial<TextAnnotation2dProps>): TextAnnotation2d {
      return TextAnnotation2d.fromJSON({
        category: seedCategoryId,
        model: seedModelId,
        code: Code.createEmpty(),
        placement: {
          origin: { x: 0, y: 0 },
          angle: Angle.createDegrees(0).toJSON(),
        },
        ...props,
        classFullName: TextAnnotation2d.classFullName,
      }, imodel);
    }



    it("create method does not automatically compute the geometry", () => {
      const annotation = createAnnotation();
      const el = createElement2d({ jsonProperties: { annotation: annotation.toJSON() } });
      expect(el.getAnnotation()!.equals(annotation)).to.be.true;
      expect(el.geom).to.be.undefined;
    });

    function expectPlacement(el: GeometricElement2d, expectValidBBox: boolean, expectedOrigin = [0, 0, 0], expectedYPR = [0, 0, 0]): void {
      expect(el.placement.origin.x).to.equal(expectedOrigin[0]);
      expect(el.placement.origin.y).to.equal(expectedOrigin[1]);
      expect(el.placement.angle.degrees).to.equal(expectedYPR[0]);
      expect(el.placement.bbox.isNull).to.equal(!expectValidBBox);
    }

    describe("inserts 2d element and round-trips through JSON", async () => {
      async function test(annotation?: TextAnnotation): Promise<void> {
        const el0 = createElement2d();
        if (annotation) {
          el0.setAnnotation(annotation);
        }

        expectPlacement(el0, false);
        expect(el0.toJSON().elementGeometryBuilderParams).not.to.be.undefined;

        const elId = el0.insert();

        expect(Id64.isValidId64(elId)).to.be.true;

        const el1 = imodel.elements.getElement<TextAnnotation2d>(elId);
        expect(el1).not.to.be.undefined;
        expect(el1 instanceof TextAnnotation2d).to.be.true;

        expectPlacement(el1, undefined !== annotation && !annotation.textBlock.isEmpty);

        const anno = el1.getAnnotation();

        if (!annotation) {
          expect(anno).to.be.undefined;
        } else {
          expect(anno).not.to.be.undefined;
          expect(anno!.equals(annotation)).to.be.true;
        }
      }

      it("roundtrips an empty annotation", async () => { await test(); });
      it("roundtrips an annotation with a style", async () => { await test(TextAnnotation.fromJSON({ textBlock: { styleName: "block" } })); });
      it("roundtrips an annotation with a textBlock", async () => { await test(createAnnotation()); });
    });
  });
});
