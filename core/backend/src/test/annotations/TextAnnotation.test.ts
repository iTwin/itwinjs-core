/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Angle, Point3d, Range2d, Range3d, YawPitchRollAngles } from "@itwin/core-geometry";
import { FractionRun, SubCategoryAppearance, TextAnnotation, TextAnnotation2dProps, TextAnnotation3dProps, TextAnnotationProps, TextBlock, TextRun, TextStyleSettings, TextStyleSettingsProps } from "@itwin/core-common";
import { IModelDb, StandaloneDb } from "../../IModelDb";
import { AnnotationTextStyle, TextAnnotation2d, TextAnnotation3d } from "../../annotations/TextAnnotationElement";
import { IModelTestUtils } from "../IModelTestUtils";
import { GeometricElement2d, GeometricElement3d, Subject } from "../../Element";
import { Guid, Id64, Id64String } from "@itwin/core-bentley";
import { DefinitionModel } from "../../Model";
import { DrawingCategory, SpatialCategory } from "../../Category";
import { DisplayStyle2d, DisplayStyle3d } from "../../DisplayStyle";
import { CategorySelector, DrawingViewDefinition, ModelSelector, SpatialViewDefinition } from "../../ViewDefinition";
import { FontFile } from "../../FontFile";
import { computeTextRangeAsStringLength } from "../AnnotationTestUtils";


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

function createAnnotation(styleId?: Id64String): TextAnnotation {
  const styleOverrides = { fontName: "Karla" };
  const block = TextBlock.create({ styleId: styleId ?? "0x42", styleOverrides });
  block.appendRun(TextRun.create({ content: "Run, Barry,", styleId: styleId ?? "0x43", styleOverrides }));
  block.appendRun(TextRun.create({ content: " RUN!!! ", styleId: styleId ?? "0x44", styleOverrides }));
  block.appendRun(FractionRun.create({ numerator: "Harrison", denominator: "Wells", styleId: styleId ?? "0x45", styleOverrides }));
  block.margins = { left: 0, right: 1, top: 2, bottom: 3 };

  const annotation = TextAnnotation.fromJSON({ textBlock: block.toJSON() });
  annotation.anchor = { vertical: "middle", horizontal: "right" };
  annotation.orientation = YawPitchRollAngles.createDegrees(1, 0, -1);
  annotation.offset = Point3d.create(10, -5, 0);
  annotation.leaders = [{ startPoint: Point3d.createZero(), attachment: { mode: "Nearest" } }]
  return annotation;
}

const createJobSubjectElement = (iModel: IModelDb, name: string): Subject => {
  const subj = Subject.create(iModel, iModel.elements.getRootSubject().id, name);
  subj.setJsonProperty("Subject", { Job: name }); // eslint-disable-line @typescript-eslint/naming-convention

  return subj;
}


const insertDrawingModel = (standaloneModel: StandaloneDb, parentId: Id64String, definitionModel: Id64String) => {
  const category = DrawingCategory.insert(standaloneModel, definitionModel, "DrawingCategory", new SubCategoryAppearance());
  const [_, model] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(standaloneModel, { spec: '0x1', scope: '0x1', value: 'Drawing' }, undefined, parentId);

  const displayStyle = DisplayStyle2d.insert(standaloneModel, definitionModel, "DisplayStyle2d");
  const categorySelector = CategorySelector.insert(standaloneModel, definitionModel, "DrawingCategories", [category]);
  const viewRange = new Range2d(0, 0, 500, 500);
  DrawingViewDefinition.insert(standaloneModel, definitionModel, "Drawing View", model, categorySelector, displayStyle, viewRange);

  return { category, model };
}

const insertSpatialModel = (standaloneModel: StandaloneDb, parentId: Id64String, definitionModel: Id64String) => {
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

const createAnnotationTextStyle = (iModel: IModelDb, definitionModel: Id64String, name: string, settings: TextStyleSettingsProps = TextStyleSettings.defaultProps): AnnotationTextStyle => {
  return AnnotationTextStyle.create(
    iModel,
    definitionModel,
    name,
    settings,
    "description",
  )
}

type CreateTextAnnotationArgs<T> = Partial<Omit<T, "textAnnotationData">> & { textAnnotationData?: TextAnnotationProps };

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
    it("returns undefined if not provided", () => {
      expect(makeElement().getAnnotation()).to.be.undefined;
    });

    it("converts JSON string to class instance", () => {
      const elem = makeElement({
        textAnnotationData: JSON.stringify({textBlock: TextBlock.create({ styleId: "0x42" }).toJSON()})
      });

      const anno = elem.getAnnotation()!;
      expect(anno).not.to.be.undefined;
      expect(anno.textBlock.isEmpty).to.be.true;
      expect(anno.textBlock.styleId).to.equal("0x42");
    });

    it("produces a new object each time it is called", () => {
      const elem = makeElement({
        textAnnotationData: JSON.stringify({textBlock: TextBlock.create({ styleId: "0x42" }).toJSON()})
      });

      const anno1 = elem.getAnnotation()!;
      const anno2 = elem.getAnnotation()!;
      expect(anno1).not.to.equal(anno2);
      expect(anno1.textBlock.equals(anno2.textBlock)).to.be.true;
    });
  });

  describe("setAnnotation", () => {
    it("updates properties", () => {
      const elem = makeElement();

      const textBlock = TextBlock.create({ styleId: "0x42" });
      textBlock.appendRun(TextRun.create({ content: "text", styleId: "0x43" }));
      const annotation = TextAnnotation.fromJSON({ textBlock: textBlock.toJSON() });
      elem.setAnnotation(annotation);

      expect(elem.getAnnotation()!.toJSON()).to.deep.equal(annotation.toJSON());
      expect(elem.getAnnotation()!.toJSON()).not.to.equal(annotation.toJSON());
    });
  });

  describe("TextAnnotation3d Persistence", () => {
    let imodel: StandaloneDb;
    let seedCategoryId: string;
    let seedModelId: string;
    let seedStyleId: string;

    before(async () => {
      imodel = await createIModel("TextAnnotation3d");
      const jobSubjectId = createJobSubjectElement(imodel, "Job").insert();
      const definitionModel = DefinitionModel.insert(imodel, jobSubjectId, "Definition");
      const { category, model } = insertSpatialModel(imodel, jobSubjectId, definitionModel);
      const styleId = createAnnotationTextStyle(imodel, definitionModel, "test", {fontName: "Totally Real Font", lineHeight: 0.25, isItalic: true}).insert();

      expect(jobSubjectId).not.to.be.undefined;
      expect(category).not.to.be.undefined;
      expect(model).not.to.be.undefined;
      expect(styleId).not.to.be.undefined;

      seedCategoryId = category;
      seedModelId = model;
      seedStyleId = styleId;
    });

    after(() => imodel.close());

    function createElement3d(createArgs?: CreateTextAnnotationArgs<TextAnnotation3dProps>): TextAnnotation3d {
      return TextAnnotation3d.create(
        imodel,
        seedCategoryId,
        seedModelId,
        {
          origin: { x: 0, y: 0, z: 0 },
          angles: YawPitchRollAngles.createDegrees(0, 0, 0).toJSON(),
        },
        createArgs?.textAnnotationData,
      )
    }

    it("creating element does not automatically compute the geometry", () => {
      const annotation = createAnnotation();
      const el = createElement3d({ textAnnotationData: annotation.toJSON() });
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

        const elId = el0.insert()

        expect(Id64.isValidId64(elId)).to.be.true;

        const el1 = imodel.elements.getElement<TextAnnotation3d>(elId);
        expect(el1).not.to.be.undefined;
        expect(el1 instanceof TextAnnotation3d).to.be.true;

        expectPlacement3d(el1, undefined !== annotation && !annotation.textBlock.isEmpty);

        const anno = el1.getAnnotation();

        if (!annotation) {
          expect(anno).to.be.undefined;
          expect(el0.toJSON().elementGeometryBuilderParams).to.be.undefined;
        } else {
          expect(anno).not.to.be.undefined;
          expect(anno!.equals(annotation)).to.be.true;
          expect(el0.toJSON().elementGeometryBuilderParams).not.to.be.undefined;
        }
      }

      it("roundtrips an empty annotation", async () => { await test(); });
      it("roundtrips an annotation with a style", async () => { await test(TextAnnotation.fromJSON({ textBlock: { styleId: seedStyleId } })); });
      it("roundtrips an annotation with a textBlock", async () => { await test(createAnnotation()); });
    });
  });

  describe("TextAnnotation2d Persistence", () => {
    let imodel: StandaloneDb;
    let seedCategoryId: string;
    let seedModelId: string;
    let seedStyleId: string;

    before(async () => {
      imodel = await createIModel("TextAnnotation2d");
      const jobSubjectId = createJobSubjectElement(imodel, "Job").insert();
      const definitionModel = DefinitionModel.insert(imodel, jobSubjectId, "Definition");
      const { category, model } = insertDrawingModel(imodel, jobSubjectId, definitionModel);
      const styleId = createAnnotationTextStyle(imodel, definitionModel, "test", {fontName: "Totally Real Font", lineHeight: 0.25, isItalic: true}).insert();

      expect(jobSubjectId).not.to.be.undefined;
      expect(category).not.to.be.undefined;
      expect(model).not.to.be.undefined;
      expect(styleId).not.to.be.undefined;

      seedCategoryId = category;
      seedModelId = model;
      seedStyleId = styleId;
    });

    after(() => {
      imodel.saveChanges("tests");
      imodel.close();
    });

    function createElement2d(createArgs?: CreateTextAnnotationArgs<TextAnnotation2dProps>): TextAnnotation2d {
      return TextAnnotation2d.create(
        imodel,
        seedCategoryId,
        seedModelId,
        {
          origin: { x: 0, y: 0 },
          angle: Angle.createDegrees(0).toJSON(),
        },
        createArgs?.textAnnotationData,
      )
    }

    it("creating element does not automatically compute the geometry", () => {
      const annotation = createAnnotation();
      const el = createElement2d({ textAnnotationData: annotation.toJSON() });
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

        const elId = el0.insert();

        expect(Id64.isValidId64(elId)).to.be.true;

        const el1 = imodel.elements.getElement<TextAnnotation2d>(elId);
        expect(el1).not.to.be.undefined;
        expect(el1 instanceof TextAnnotation2d).to.be.true;

        expectPlacement2d(el1, undefined !== annotation && !annotation.textBlock.isEmpty);

        const anno = el1.getAnnotation();

        if (!annotation) {
          expect(anno).to.be.undefined;
          expect(el0.toJSON().elementGeometryBuilderParams).to.be.undefined;
        } else {
          expect(anno).not.to.be.undefined;
          expect(anno!.equals(annotation)).to.be.true;
          expect(el0.toJSON().elementGeometryBuilderParams).not.to.be.undefined;
        }
      }

      it("roundtrips an empty annotation", async () => { await test(); });
      it("roundtrips an annotation with a style", async () => { await test(TextAnnotation.fromJSON({ textBlock: { styleId: seedStyleId } })); });
      it("roundtrips an annotation with a textBlock", async () => { await test(createAnnotation()); });
    });
  });
});

describe("AnnotationTextStyle", () => {
  let imodel: StandaloneDb;
  let seedSubjectId: string;
  let seedDefinitionModel: string;
  let seedCategoryId: string;
  let seedModelId: string;

  before(async () => {
    imodel = await createIModel("AnnotationTextStyle");
    const jobSubjectId = createJobSubjectElement(imodel, "Job").insert();
    const definitionModel = DefinitionModel.insert(imodel, jobSubjectId, "Definition");
    const { category, model } = insertDrawingModel(imodel, jobSubjectId, definitionModel);

    expect(jobSubjectId).not.to.be.undefined;
    expect(definitionModel).not.to.be.undefined;
    expect(category).not.to.be.undefined;
    expect(model).not.to.be.undefined;

    seedSubjectId = jobSubjectId;
    seedDefinitionModel = definitionModel;
    seedCategoryId = category;
    seedModelId = model;
  });

  after(() => {
    imodel.close();
  });

  function createElement2d(createArgs?: CreateTextAnnotationArgs<TextAnnotation2dProps>): TextAnnotation2d {
    return TextAnnotation2d.create(
      imodel,
      seedCategoryId,
      seedModelId,
      {
        origin: { x: 0, y: 0 },
        angle: Angle.createDegrees(0).toJSON(),
      },
      createArgs?.textAnnotationData,
    )
  }

  it("inserts a style and round-trips through JSON", async () => {
    const textStyle = TextStyleSettings.fromJSON({
      fontName: "Totally Real Font",
      isUnderlined: true,
      lineHeight: 0.5
    })
    const el0 = createAnnotationTextStyle(imodel, seedDefinitionModel, "round-trip", textStyle.toJSON());

    const elId = el0.insert();

    expect(Id64.isValidId64(elId)).to.be.true;

    const el1 = imodel.elements.getElement<AnnotationTextStyle>(elId);
    expect(el1).not.to.be.undefined;
    expect(el1 instanceof AnnotationTextStyle).to.be.true;

    const style = el1.settings;
    expect(style).not.to.be.undefined;

    expect(style.toJSON()).to.deep.equal(textStyle.toJSON());
  });

  it("does not allow elements with invalid styles to be inserted", async () => {
    // Default style should fail since it has no font
    let annotationTextStyle = createAnnotationTextStyle(imodel, seedDefinitionModel, "default");
    expect(() => annotationTextStyle.insert()).to.throw();
    // font is required
    annotationTextStyle = createAnnotationTextStyle(imodel, seedDefinitionModel, "no font", { fontName: ""});
    expect(() => annotationTextStyle.insert()).to.throw();
    // lineHeight should be positive
    annotationTextStyle = createAnnotationTextStyle(imodel, seedDefinitionModel, "invalid lineHeight", { fontName: "Totally Real Font", lineHeight: 0 });
    expect(() => annotationTextStyle.insert()).to.throw();
    // stackedFractionScale should be positive
    annotationTextStyle = createAnnotationTextStyle(imodel, seedDefinitionModel, "invalid stackedFractionScale", { fontName: "Totally Real Font", stackedFractionScale: 0 });
    expect(() => annotationTextStyle.insert()).to.throw();
  });

  it("allows delete if unused", async () => {
    const el0 = createAnnotationTextStyle(imodel, seedDefinitionModel, "unused delete", {fontName: "Totally Real Font"});
    const elId = el0.insert();
    const el1 = imodel.elements.getElement<AnnotationTextStyle>(elId);
    expect(el1).not.to.be.undefined;
    expect(el1 instanceof AnnotationTextStyle).to.be.true;

    const annotation = TextAnnotation.fromJSON({ textBlock: { styleId: "" } });
    const annoEl = createElement2d({ textAnnotationData: annotation.toJSON() });
    annoEl.insert();


    expect(() => imodel.elements.deleteDefinitionElements([elId])).to.not.throw();
    const inUseIds = imodel.elements.deleteDefinitionElements([elId]);
    expect(inUseIds).to.be.empty;
    const el2 = imodel.elements.tryGetElement<AnnotationTextStyle>(elId);
    expect(el2).to.be.undefined;
  });

  it("does not allow delete if used", async () => {
    const el0 = createAnnotationTextStyle(imodel, seedDefinitionModel, "used delete", {fontName: "Totally Real Font"});
    const elId = el0.insert();
    const el1 = imodel.elements.getElement<AnnotationTextStyle>(elId);
    expect(el1).not.to.be.undefined;
    expect(el1 instanceof AnnotationTextStyle).to.be.true;

    const annotation = TextAnnotation.fromJSON({ textBlock: { styleId: elId } });
    const annoEl = createElement2d({ textAnnotationData: annotation.toJSON() });
    annoEl.insert();

    expect(() => imodel.elements.deleteDefinitionElements([elId])).to.throw("Cannot delete AnnotationTextStyle because it is referenced by a TextAnnotation element");
    const el2 = imodel.elements.tryGetElement<AnnotationTextStyle>(elId);
    expect(el2).not.to.be.undefined;
    expect(el2 instanceof AnnotationTextStyle).to.be.true;
  });

  it("uses default style if none specified", async () => {
    const el0 = AnnotationTextStyle.fromJSON({
      classFullName: AnnotationTextStyle.classFullName,
      model: seedSubjectId,
      code: AnnotationTextStyle.createCode(imodel, seedSubjectId, "style1"),
    }, imodel);
    expect(el0.settings).not.to.be.undefined;
    expect(el0.settings.toJSON()).to.deep.equal(TextStyleSettings.defaultProps);
  });

  it("can update style via cloning", async () => {
    const el0 = createAnnotationTextStyle(imodel, seedDefinitionModel, "cloning", { fontName: "Totally Real Font" });
    const newStyle = el0.settings.clone({isBold: true, lineSpacingFactor: 3});
    expect(el0.settings.toJSON()).to.not.deep.equal(newStyle.toJSON());
    el0.settings = newStyle;
    expect(el0.settings.toJSON()).to.deep.equal(newStyle.toJSON());
  });
});