/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import {
  CategorySelector, ComputeRangesForTextLayoutArgs, DefinitionModel, DisplayStyle2d, DisplayStyle3d, DrawingCategory,
  DrawingViewDefinition, FontFile, GeometricElement2d, GeometricElement3d, IModelDb, ModelSelector, SpatialCategory,
  SpatialViewDefinition, StandaloneDb, Subject, TextAnnotation2d, TextAnnotation3d, TextLayoutRanges,
} from "@itwin/core-backend";
import { Angle, Point3d, Range2d, Range3d, YawPitchRollAngles } from "@itwin/core-geometry";
import { Code, ColorDef, FractionRun, SubCategoryAppearance, TextAnnotation, TextAnnotation2dProps, TextAnnotation3dProps, TextBlock, TextRun } from "@itwin/core-common";
import { IModelTestUtils } from "@itwin/backend-test-support";
import { Guid, Id64, Id64String } from "@itwin/core-bentley";

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
    block.appendRun(TextRun.create({ content: " RUN!!! ", styleName: "run2", styleOverrides }));
    block.appendRun(FractionRun.create({ numerator: "Harrison", denominator: "Wells", styleName: "run3", styleOverrides }));
    block.margins = { left: 0, right: 1, top: 2, bottom: 3 };

    const annotation = TextAnnotation.fromJSON({ textBlock: block.toJSON() });
    annotation.anchor = { vertical: "middle", horizontal: "right" };
    annotation.orientation = YawPitchRollAngles.createDegrees(1, 0, -1);
    annotation.offset = Point3d.create(10, -5, 0);
    annotation.frame = { shape: "rectangle", border: ColorDef.red.toJSON(), fill: ColorDef.green.toJSON(), borderWeight: 2 };

    return annotation;
  }

  const createJobSubjectElement = (iModel: IModelDb, name: string): Subject => {
    const subj = Subject.create(iModel, iModel.elements.getRootSubject().id, name);
    subj.setJsonProperty("Subject", { Job: name }); // eslint-disable-line @typescript-eslint/naming-convention

    return subj;
  }

  const insertDrawingModel = (standaloneModel: StandaloneDb, parentId: Id64String) => {
    const definitionModel = DefinitionModel.insert(standaloneModel, parentId, "DrawingDefinition");
    const category = DrawingCategory.insert(standaloneModel, definitionModel, "DrawingCategory", new SubCategoryAppearance());
    const [_, model] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(standaloneModel, { spec: '0x1', scope: '0x1', value: 'Drawing' }, undefined, parentId);

    const displayStyle = DisplayStyle2d.insert(standaloneModel, definitionModel, "DisplayStyle2d");
    const categorySelector = CategorySelector.insert(standaloneModel, definitionModel, "DrawingCategories", [category]);
    const viewRange = new Range2d(0, 0, 500, 500);
    DrawingViewDefinition.insert(standaloneModel, definitionModel, "Drawing View", model, categorySelector, displayStyle, viewRange);

    return { category, model };
  }

  const insertSpatialModel = (standaloneModel: StandaloneDb, parentId: Id64String) => {
    const definitionModel = DefinitionModel.insert(standaloneModel, parentId, "SpatialDefinition");
    const category = SpatialCategory.insert(standaloneModel, definitionModel, "spatialCategory", new SubCategoryAppearance());
    const [_, model] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(standaloneModel, { spec: '0x1', scope: '0x1', value: 'Spatial' }, undefined, parentId);
    const modelSelector = ModelSelector.insert(standaloneModel, definitionModel, "SpatialModelSelector", [model]);

    const displayStyle = DisplayStyle3d.insert(standaloneModel, definitionModel, "DisplayStyle3d");
    const categorySelector = CategorySelector.insert(standaloneModel, definitionModel, "spatialCategories", [category]);
    const viewRange = new Range3d(0, 0, 0, 500, 500, 500);
    SpatialViewDefinition.insertWithCamera(standaloneModel, definitionModel, "spatial View", modelSelector, categorySelector, displayStyle, viewRange);

    return { category, model };
  }

  const createIModel = async (name: string): Promise<StandaloneDb> => {
    const filePath = IModelTestUtils.prepareOutputFile("annotationTests", `${name}.bim`);
    const iModel = StandaloneDb.createEmpty(filePath, {
      rootSubject: { name: `${name} tests`, description: `${name} tests` },
      client: "integration tests",
      globalOrigin: { x: 0, y: 0 },
      projectExtents: { low: { x: -500, y: -500, z: -50 }, high: { x: 500, y: 500, z: 50 } },
      guid: Guid.createValue(),
    });
    await iModel.fonts.embedFontFile({
      file: FontFile.createFromTrueTypeFileName(IModelTestUtils.resolveFontFile("Karla-Regular.ttf"))
    })

    return iModel;
  }

  describe("TextAnnotation3d Persistence", () => {
    let imodel: StandaloneDb;
    let seedCategoryId: string;
    let seedModelId: string;

    before(async () => {
      imodel = await createIModel("TextAnnotation3d");
      const jobSubjectId = createJobSubjectElement(imodel, "Job").insert();
      const { category, model } = insertSpatialModel(imodel, jobSubjectId);

      expect(jobSubjectId).not.to.be.undefined;
      expect(category).not.to.be.undefined;
      expect(model).not.to.be.undefined;

      seedCategoryId = category;
      seedModelId = model;
    });

    after(() => imodel.close());

    function createElement3d(props?: Partial<TextAnnotation3dProps>): TextAnnotation3d {
      return TextAnnotation3d.fromJSON({
        category: seedCategoryId,
        model: seedModelId,
        code: Code.createEmpty(),
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

    function expectPlacement3d(el: GeometricElement3d, expectValidBBox: boolean, expectedOrigin = [0, 0, 0], expectedYPR = [0, 0, 0]): void {
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

        expectPlacement3d(el0, false);
        expect(el0.toJSON().elementGeometryBuilderParams).not.to.be.undefined;


        const elId = el0.insert()

        expect(Id64.isValidId64(elId)).to.be.true;

        const el1 = imodel.elements.getElement<TextAnnotation3d>(elId);
        expect(el1).not.to.be.undefined;
        expect(el1 instanceof TextAnnotation3d).to.be.true;

        expectPlacement3d(el1, undefined !== annotation && !annotation.textBlock.isEmpty);

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
  describe("TextAnnotation2d Persistence", () => {
    let imodel: StandaloneDb;
    let seedCategoryId: string;
    let seedModelId: string;

    before(async () => {
      imodel = await createIModel("TextAnnotation2d");
      const jobSubjectId = createJobSubjectElement(imodel, "Job").insert();
      const { category, model } = insertDrawingModel(imodel, jobSubjectId);

      expect(jobSubjectId).not.to.be.undefined;
      expect(category).not.to.be.undefined;
      expect(model).not.to.be.undefined;

      seedCategoryId = category;
      seedModelId = model;
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

    function expectPlacement2d(el: GeometricElement2d, expectValidBBox: boolean, expectedOrigin = [0, 0, 0], expectedYPR = [0, 0, 0]): void {
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

        expectPlacement2d(el0, false);
        expect(el0.toJSON().elementGeometryBuilderParams).not.to.be.undefined;

        const elId = el0.insert();

        expect(Id64.isValidId64(elId)).to.be.true;

        const el1 = imodel.elements.getElement<TextAnnotation2d>(elId);
        expect(el1).not.to.be.undefined;
        expect(el1 instanceof TextAnnotation2d).to.be.true;

        expectPlacement2d(el1, undefined !== annotation && !annotation.textBlock.isEmpty);

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
