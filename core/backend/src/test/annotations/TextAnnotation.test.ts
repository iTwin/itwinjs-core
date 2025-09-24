/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Angle, Point3d, Range2d, Range3d, YawPitchRollAngles } from "@itwin/core-geometry";
import { FractionRun, Placement2dProps, Placement3dProps, SubCategoryAppearance, TextAnnotation, TextAnnotation2dProps, TextBlock, TextRun, TextStyleSettings, TextStyleSettingsProps } from "@itwin/core-common";
import { IModelDb, StandaloneDb } from "../../IModelDb";
import { AnnotationTextStyle, TextAnnotation2d, TextAnnotation2dCreateArgs, TextAnnotation3d, TextAnnotation3dCreateArgs } from "../../annotations/TextAnnotationElement";
import { IModelTestUtils } from "../IModelTestUtils";
import { GeometricElement2d, GeometricElement3d, Subject } from "../../Element";
import { Guid, Id64, Id64String } from "@itwin/core-bentley";
import { DefinitionModel } from "../../Model";
import { DrawingCategory, SpatialCategory } from "../../Category";
import { DisplayStyle2d, DisplayStyle3d } from "../../DisplayStyle";
import { CategorySelector, DrawingViewDefinition, ModelSelector, SpatialViewDefinition } from "../../ViewDefinition";
import { FontFile } from "../../FontFile";
import { computeTextRangeAsStringLength, MockBuilder } from "../AnnotationTestUtils";
import { TextAnnotationUsesTextStyleByDefault } from "../../annotations/ElementDrivesTextAnnotation";
import { layoutTextBlock, TextStyleResolver } from "../../annotations/TextBlockLayout";
import { appendTextAnnotationGeometry } from "../../annotations/TextAnnotationGeometry";


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

function createAnnotation(textBlock?: TextBlock): TextAnnotation {
  const styleOverrides = { fontName: "Karla" };
  const block = textBlock ?? TextBlock.create({ styleOverrides });
  if (!textBlock) {
    block.appendRun(TextRun.create({ content: "Run, Barry,", styleOverrides }));
    block.appendRun(TextRun.create({ content: " RUN!!! ", styleOverrides }));
    block.appendRun(FractionRun.create({ numerator: "Harrison", denominator: "Wells", styleOverrides }));
    block.margins = { left: 0, right: 1, top: 2, bottom: 3 };
  }

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

function createElement2d(imodel: IModelDb, createArgs: Omit<TextAnnotation2dCreateArgs, "placement">): TextAnnotation2d {
  const placement: Placement2dProps = {
    origin: { x: 0, y: 0 },
    angle: Angle.createDegrees(0).toJSON(),
  };

  return TextAnnotation2d.create(
    imodel,
    {
      ...createArgs,
      placement,
    }
  );
}

function createElement3d(imodel: IModelDb, createArgs: Omit<TextAnnotation3dCreateArgs, "placement">): TextAnnotation3d {
  const placement: Placement3dProps = {
    origin: { x: 0, y: 0, z: 0 },
    angles: YawPitchRollAngles.createDegrees(0, 0, 0).toJSON(),
  };

  return TextAnnotation3d.create(
    imodel,
    {
      ...createArgs,
      placement,
    }
  );
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
      defaultTextStyle: new TextAnnotationUsesTextStyleByDefault("0x21").toJSON(),
      ...props,
    }, mockIModel());
  }

  describe("getAnnotation", () => {
    it("returns undefined if not provided", () => {
      expect(makeElement().getAnnotation()).to.be.undefined;
    });

    it("converts JSON string to class instance", () => {
      const elem = makeElement({
        textAnnotationData: JSON.stringify({textBlock: TextBlock.create().toJSON()}),
        defaultTextStyle: new TextAnnotationUsesTextStyleByDefault("0x42").toJSON()
      });

      const anno = elem.getAnnotation()!;
      expect(anno).not.to.be.undefined;
      expect(anno.textBlock.isEmpty).to.be.true;
      expect(elem.defaultTextStyle).not.to.be.undefined;
      expect(elem.defaultTextStyle!.id).to.equal("0x42");
    });

    it("produces a new object each time it is called", () => {
      const elem = makeElement({
        textAnnotationData: JSON.stringify({textBlock: TextBlock.create().toJSON()})
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

      const textBlock = TextBlock.create();
      textBlock.appendRun(TextRun.create({ content: "text" }));
      const annotation = TextAnnotation.fromJSON({ textBlock: textBlock.toJSON() });
      elem.setAnnotation(annotation);

      expect(elem.getAnnotation()!.toJSON()).to.deep.equal(annotation.toJSON());
      expect(elem.getAnnotation()!.toJSON()).not.to.equal(annotation.toJSON());
    });
  });

  describe("TextAnnotation3d Persistence", () => {
    let imodel: StandaloneDb;
    let createElement3dArgs: Omit<TextAnnotation3dCreateArgs, "placement">;

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

      createElement3dArgs = { category, model };
    });

    after(() => imodel.close());

    it("creating element does not automatically compute the geometry", () => {
      const annotation = createAnnotation();
      const args = { ...createElement3dArgs, textAnnotationData: annotation.toJSON() };
      const el = createElement3d(imodel, args);
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
        const el0 = createElement3d(imodel, { ...createElement3dArgs });
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
      it("roundtrips an annotation with a textBlock", async () => { await test(createAnnotation()); });
    });
  });

  describe("TextAnnotation2d Persistence", () => {
    let imodel: StandaloneDb;
    let createElement2dArgs: Omit<TextAnnotation2dCreateArgs, "placement">;

    before(async () => {
      imodel = await createIModel("TextAnnotation2d");
      const jobSubjectId = createJobSubjectElement(imodel, "Job").insert();
      const definitionModel = DefinitionModel.insert(imodel, jobSubjectId, "Definition");
      const { category, model } = insertDrawingModel(imodel, jobSubjectId, definitionModel);

      expect(jobSubjectId).not.to.be.undefined;
      expect(category).not.to.be.undefined;
      expect(model).not.to.be.undefined;

      createElement2dArgs = { category, model };
    });

    after(() => {
      imodel.saveChanges("tests");
      imodel.close();
    });

    it("creating element does not automatically compute the geometry", () => {
      const annotation = createAnnotation();
      const args = { ...createElement2dArgs, textAnnotationData: annotation.toJSON() };
      const el = createElement2d(imodel, args);
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
        const el0 = createElement2d(imodel, createElement2dArgs);
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
          expect(el0.toJSON().elementGeometryBuilderParams).to.deep.equal(el1.toJSON().elementGeometryBuilderParams);
        }
      }

      it("roundtrips an empty annotation", async () => { await test(); });
      it("roundtrips an annotation with a textBlock", async () => { await test(createAnnotation()); });
    });
  });

  describe("defaultTextStyle", () => {
    let imodel: StandaloneDb;
    let seedSubjectId: string;
    let seedDefinitionModelId: string;
    let seedStyleId: string;
    let seedStyleId2: string;

    before(async () => {
      imodel = await createIModel("DefaultTextStyle");
      const jobSubjectId = createJobSubjectElement(imodel, "Job").insert();
      const definitionModel = DefinitionModel.insert(imodel, jobSubjectId, "Definition");
      const styleId = createAnnotationTextStyle(imodel, definitionModel, "test", {fontName: "Totally Real Font", lineHeight: 0.25, isItalic: true}).insert();
      const differentStyleId = createAnnotationTextStyle(imodel, definitionModel, "alt", {fontName: "Karla", lineHeight: 0.5, isBold: true}).insert();

      expect(jobSubjectId).not.to.be.undefined;
      expect(definitionModel).not.to.be.undefined;
      expect(styleId).not.to.be.undefined;
      expect(differentStyleId).not.to.be.undefined;

      seedSubjectId = jobSubjectId;
      seedDefinitionModelId = definitionModel;
      seedStyleId = styleId;
      seedStyleId2 = differentStyleId;
    });

    after(() => {
      imodel.saveChanges("tests");
      imodel.close();
    });

    describe("TextAnnotation2d", () => {
      let createElement2dArgs: Omit<TextAnnotation2dCreateArgs, "placement">;

      before(() => {
        const { category, model } = insertDrawingModel(imodel, seedSubjectId, seedDefinitionModelId);
        expect(category).not.to.be.undefined;
        expect(model).not.to.be.undefined;
        createElement2dArgs = { category, model };
      });

      it("preserves defaultTextStyle after round trip", () => {
        const annotation = createAnnotation();
        const args = { ...createElement2dArgs, textAnnotationData: annotation.toJSON(), defaultTextStyleId: seedStyleId };
        const el0 = createElement2d(imodel, args);
        expect(el0.defaultTextStyle).not.to.be.undefined;
        expect(el0.defaultTextStyle!.id).to.equal(seedStyleId);
        el0.insert();

        const el1 = imodel.elements.getElement<TextAnnotation2d>(el0.id);
        expect(el1).not.to.be.undefined;
        expect(el1.defaultTextStyle).not.to.be.undefined;
        expect(el1.defaultTextStyle!.id).to.equal(seedStyleId);
        expect(el0.toJSON().elementGeometryBuilderParams).to.deep.equal(el1.toJSON().elementGeometryBuilderParams);
      });

      it("produces different geometry when defaultTextStyle changes", () => {
        const annotation = createAnnotation();
        const args = { ...createElement2dArgs, textAnnotationData: annotation.toJSON() };
        const el0 = createElement2d(imodel, args);
        el0.defaultTextStyle = new TextAnnotationUsesTextStyleByDefault(seedStyleId);
        const geom1 = el0.toJSON().elementGeometryBuilderParams;

        el0.defaultTextStyle = new TextAnnotationUsesTextStyleByDefault(seedStyleId2);

        const geom2 = el0.toJSON().elementGeometryBuilderParams;
        expect(geom1).not.to.deep.equal(geom2);
      });

      it("allows defaultTextStyle to be undefined", () => {
        const annotation = createAnnotation();
        const args = { ...createElement2dArgs, textAnnotationData: annotation.toJSON() };

        const el0 = createElement2d(imodel, args);
        el0.defaultTextStyle = undefined;
        const elId = el0.insert();

        expect(Id64.isValidId64(elId)).to.be.true;
        const el1 = imodel.elements.getElement<TextAnnotation2d>(elId);
        expect(el1).not.to.be.undefined;
        expect(el1 instanceof TextAnnotation2d).to.be.true;
        expect(el1.defaultTextStyle).to.be.undefined;
      });
    });

    describe("TextAnnotation3d", () => {
      let createElement3dArgs: Omit<TextAnnotation3dCreateArgs, "placement">;

      before(() => {
        const { category, model } = insertSpatialModel(imodel, seedSubjectId, seedDefinitionModelId);
        expect(category).not.to.be.undefined;
        expect(model).not.to.be.undefined;
        createElement3dArgs = { category, model };
      });

      it("preserves defaultTextStyle after round trip", () => {
        const annotation = createAnnotation();
        const args = { ...createElement3dArgs, textAnnotationData: annotation.toJSON(), defaultTextStyleId: seedStyleId };
        const el0 = createElement3d(imodel, args);
        expect(el0.defaultTextStyle).not.to.be.undefined;
        expect(el0.defaultTextStyle!.id).to.equal(seedStyleId);
        el0.insert();

        const el1 = imodel.elements.getElement<TextAnnotation3d>(el0.id);
        expect(el1).not.to.be.undefined;
        expect(el1.defaultTextStyle).not.to.be.undefined;
        expect(el1.defaultTextStyle!.id).to.equal(seedStyleId);
        expect(el0.toJSON().elementGeometryBuilderParams).to.deep.equal(el1.toJSON().elementGeometryBuilderParams);
      });

      it("produces different geometry when defaultTextStyle changes", () => {
        const annotation = createAnnotation();
        const args = { ...createElement3dArgs, textAnnotationData: annotation.toJSON() };
        const el0 = createElement3d(imodel, args);
        el0.defaultTextStyle = new TextAnnotationUsesTextStyleByDefault(seedStyleId);
        const geom1 = el0.toJSON().elementGeometryBuilderParams;

        el0.defaultTextStyle = new TextAnnotationUsesTextStyleByDefault(seedStyleId2);

        const geom2 = el0.toJSON().elementGeometryBuilderParams;
        expect(geom1).not.to.deep.equal(geom2);
      });

      it("allows defaultTextStyle to be undefined", () => {
        const annotation = createAnnotation();
        const args = { ...createElement3dArgs, textAnnotationData: annotation.toJSON() };

        const el0 = createElement3d(imodel, args);
        el0.defaultTextStyle = undefined;
        const elId = el0.insert();

        expect(Id64.isValidId64(elId)).to.be.true;
        const el1 = imodel.elements.getElement<TextAnnotation3d>(elId);
        expect(el1).not.to.be.undefined;
        expect(el1 instanceof TextAnnotation3d).to.be.true;
        expect(el1.defaultTextStyle).to.be.undefined;
      });
    });
  });
});

describe("AnnotationTextStyle", () => {
  let imodel: StandaloneDb;
  let seedSubjectId: string;
  let seedDefinitionModel: string;

  before(async () => {
    imodel = await createIModel("AnnotationTextStyle");
    const jobSubjectId = createJobSubjectElement(imodel, "Job").insert();
    const definitionModel = DefinitionModel.insert(imodel, jobSubjectId, "Definition");

    expect(jobSubjectId).not.to.be.undefined;
    expect(definitionModel).not.to.be.undefined;

    seedSubjectId = jobSubjectId;
    seedDefinitionModel = definitionModel;
  });

  after(() => {
    imodel.close();
  });

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

  it("does not allow updating of elements to invalid styles", async () => {
    const annotationTextStyle = createAnnotationTextStyle(imodel, seedDefinitionModel, "valid style", { fontName: "Totally Real Font" });

    const elId = annotationTextStyle.insert();
    expect(Id64.isValidId64(elId)).to.be.true;
    const el1 = imodel.elements.getElement<AnnotationTextStyle>(elId);
    expect(el1).not.to.be.undefined;
    expect(el1 instanceof AnnotationTextStyle).to.be.true;

    el1.settings = el1.settings.clone({ fontName: "" });
    expect(() => el1.update()).to.throw();
    el1.settings = el1.settings.clone({ fontName: "Totally Real Font", lineHeight: 0 });
    expect(() => el1.update()).to.throw();
    el1.settings = el1.settings.clone({ lineHeight: 2, stackedFractionScale: 0 });
    expect(() => el1.update()).to.throw();
    el1.settings = el1.settings.clone({ stackedFractionScale: 0.45 });

    el1.update();
    const updatedElement = imodel.elements.getElement<AnnotationTextStyle>(elId);
    expect(updatedElement.settings.toJSON()).to.deep.equal(el1.settings.toJSON());
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

describe("appendTextAnnotationGeometry", () => {
  let imodel: StandaloneDb;
  let seedDefinitionModelId: string;
  let seedCategoryId: string;
  let seedStyleId: string;
  let seedStyleId2: string;

  before(async () => {
      imodel = await createIModel("DefaultTextStyle");
      const jobSubjectId = createJobSubjectElement(imodel, "Job").insert();
      const definitionModel = DefinitionModel.insert(imodel, jobSubjectId, "Definition");
      const { category, model } = insertDrawingModel(imodel, jobSubjectId, definitionModel);
      const styleId = createAnnotationTextStyle(imodel, definitionModel, "test", {fontName: "Totally Real Font", lineHeight: 0.25, isItalic: true}).insert();
      const differentStyleId = createAnnotationTextStyle(imodel, definitionModel, "alt", {fontName: "Karla", lineHeight: 0.5, isBold: true}).insert();

      expect(jobSubjectId).not.to.be.undefined;
      expect(definitionModel).not.to.be.undefined;
      expect(category).not.to.be.undefined;
      expect(model).not.to.be.undefined;
      expect(styleId).not.to.be.undefined;
      expect(differentStyleId).not.to.be.undefined;

      seedDefinitionModelId = definitionModel;
      seedCategoryId = category;
      seedStyleId = styleId;
      seedStyleId2 = differentStyleId;
  });

  function runAppendTextAnnotationGeometry(annotation: TextAnnotation, styleId: Id64String, scaleFactor: number = 1): MockBuilder {
    const builder = new MockBuilder();

    const resolver = new TextStyleResolver({
      textBlock: annotation.textBlock,
      textStyleId: styleId,
      iModel: imodel,
    });

    const layout = layoutTextBlock({
      textBlock: annotation.textBlock,
      iModel: imodel,
      textStyleResolver: resolver,
    });

    const result = appendTextAnnotationGeometry({
      annotationProps: annotation.toJSON(),
      layout,
      textStyleResolver: resolver,
      scaleFactor,
      builder,
      categoryId: seedCategoryId,
    });

    expect(result).to.be.true;
    return builder;
  }

  it("produces the same geometry when given the same inputs", () => {
    const builder1 = runAppendTextAnnotationGeometry(createAnnotation(), seedStyleId);
    const builder2 = runAppendTextAnnotationGeometry(createAnnotation(), seedStyleId);

    expect(builder1.geometries).to.deep.equal(builder2.geometries);
    expect(builder1.params).to.deep.equal(builder2.params);
    expect(builder1.textStrings).to.deep.equal(builder2.textStrings);
  });

  it("produces no geometry when given an empty annotation", () => {
    const block = TextBlock.create();
    const annotation = TextAnnotation.fromJSON({ textBlock: block.toJSON() });
    const builder = runAppendTextAnnotationGeometry(annotation, seedStyleId);

    expect(builder.geometries).to.be.empty;
    expect(builder.params).to.be.empty;
    expect(builder.textStrings).to.be.empty;
  });

  it("produces geometry when given an empty annotation with frame styling", () => {
    const block = TextBlock.create();
    const annotation = TextAnnotation.fromJSON({ textBlock: block.toJSON() });
    const styleId = createAnnotationTextStyle(
      imodel,
      seedDefinitionModelId,
      "empty anno style",
      {
        fontName: "Totally Real Font",
        frame: {
          shape: "rectangle",
        }
      }
    ).insert();
    const builder = runAppendTextAnnotationGeometry(annotation, styleId);

    expect(builder.geometries).not.to.be.empty;
    expect(builder.params).not.to.be.empty;
    expect(builder.textStrings).to.be.empty;
  });


  it("produces different geometry when given different text-content in annotations", () => {
    const anno1 = createAnnotation();
    const anno2 = createAnnotation();
    anno2.textBlock.appendRun(TextRun.create({ content: "extra", styleOverrides: { fontName: "Totally Real Font" } }));

    const builder1 = runAppendTextAnnotationGeometry(anno1, seedStyleId);
    const builder2 = runAppendTextAnnotationGeometry(anno2, seedStyleId);

    expect(builder1.geometries).to.not.deep.equal(builder2.geometries);
    expect(builder1.params).to.deep.equal(builder2.params);
    expect(builder1.textStrings).to.not.deep.equal(builder2.textStrings);
  });

  it("produces different geometry when given different default styles", () => {
    const builder1 = runAppendTextAnnotationGeometry(createAnnotation(), seedStyleId);
    const builder2 = runAppendTextAnnotationGeometry(createAnnotation(), seedStyleId2);

    expect(builder1.geometries).to.not.deep.equal(builder2.geometries);
    expect(builder1.textStrings).to.not.deep.equal(builder2.textStrings);
  });

  it("accounts for style overrides in the text", () => {
    const block = TextBlock.create();
    block.appendParagraph();
    block.children[0].styleOverrides = { isBold: true };
    block.appendRun(TextRun.create({ content: "Run, Barry," }));
    block.appendParagraph();
    block.appendRun(TextRun.create({ content: " RUN!!! ", styleOverrides: { isItalic: false } }));
    block.margins = { left: 0, right: 1, top: 2, bottom: 3 };

    const annotation = createAnnotation(block);

    const builder = runAppendTextAnnotationGeometry(annotation, seedStyleId);

    expect(builder.textStrings.length).to.equal(2);
    expect(builder.textStrings[0].text).to.equal("Run, Barry,");
    // From override on paragraph
    expect(builder.textStrings[0].bold).to.be.true;
    // From default style
    expect(builder.textStrings[0].italic).to.be.true;
    expect(builder.textStrings[1].text).to.equal(" RUN!!! ");
    // From default style
    expect(builder.textStrings[1].bold).to.be.false;
    // From override on run
    expect(builder.textStrings[1].italic).to.be.false;
  });

  it("uses TextStyleSettings.defaults when no default style is provided", () => {
    const block = TextBlock.create();
    block.appendRun(TextRun.create({ content: "Run, Barry," }));
    block.margins = { left: 0, right: 1, top: 2, bottom: 3 };

    const annotation = createAnnotation(block);
    const builder = runAppendTextAnnotationGeometry(annotation, "");

    expect(builder.textStrings.length).to.equal(1);
    expect(builder.textStrings[0].text).to.equal("Run, Barry,");
    expect(builder.textStrings[0].font).to.equal(0); // Font ID 0 is the "missing" font in the default text style
    expect(builder.textStrings[0].bold).to.equal(TextStyleSettings.defaultProps.isBold);
    expect(builder.textStrings[0].italic).to.equal(TextStyleSettings.defaultProps.isItalic);
    expect(builder.textStrings[0].underline).to.equal(TextStyleSettings.defaultProps.isUnderlined);
  });

  it("scales geometry correctly", () => {
    const annotation = createAnnotation();
    const builder1 = runAppendTextAnnotationGeometry(annotation, seedStyleId, 1);
    const builder2 = runAppendTextAnnotationGeometry(annotation, seedStyleId, 2);

    expect(builder1.textStrings[0].height * 2).to.equal(builder2.textStrings[0].height);
    expect(builder1.textStrings[0].width * 2).to.equal(builder2.textStrings[0].width);
  });
});