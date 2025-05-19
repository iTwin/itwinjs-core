/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { Angle, Point3d, Range2d, YawPitchRollAngles } from "@itwin/core-geometry";
import { FractionRun, TextAnnotation, TextAnnotation2dProps, TextAnnotation3dProps, TextBlock, TextRun } from "@itwin/core-common";
import { IModelDb, SnapshotDb } from "../../IModelDb";
import { TextAnnotation2d, TextAnnotation3d } from "../../annotations/TextAnnotationElement";
import { IModelTestUtils } from "../IModelTestUtils";
import { GeometricElement2d, GeometricElement3d } from "../../Element";
import { Id64 } from "@itwin/core-bentley";
import { ComputeRangesForTextLayoutArgs, TextLayoutRanges } from "../../annotations/TextBlockLayout";

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

    const block = TextBlock.create({ styleName: "block", styleOverrides: { fontName: "Arial" } });
    block.appendRun(TextRun.create({ content: "Run, Barry,", styleName: "run1" }));
    block.appendRun(TextRun.create({ content: "RUN!!!", styleName: "run2" }));
    block.appendRun(FractionRun.create({ numerator: "Harrison", denominator: "Wells", styleName: "run3" }));

    const annotation = TextAnnotation.fromJSON({ textBlock: block.toJSON() });
    annotation.anchor = { vertical: "middle", horizontal: "right" };
    annotation.orientation = YawPitchRollAngles.createDegrees(1, 0, -1);
    annotation.offset = Point3d.create(0, -5, 100);
    annotation.frame = { shape: "none" };

    return annotation;
  }

  describe("TextAnnotation3d Persistence", () => {
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

    function createElement(props?: Partial<TextAnnotation3dProps>): TextAnnotation3d {
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
      const el = createElement({ jsonProperties: { annotation: annotation.toJSON() } });
      expect(el.getAnnotation()!.equals(annotation)).to.be.true;
      expect(el.geom).to.be.undefined;
    });

    function expectPlacement(el: GeometricElement3d, expectValidBBox: boolean, expectedOrigin = [0, 0, 0], expectedYPR = [0, 0, 0]): void {
      const message = "placement should be equal";
      expect(el.placement.origin.x, message).to.equal(expectedOrigin[0]);
      expect(el.placement.origin.y, message).to.equal(expectedOrigin[1]);
      expect(el.placement.origin.z, message).to.equal(expectedOrigin[2]);
      expect(el.placement.angles.yaw.radians, message).to.equal(expectedYPR[0]);
      expect(el.placement.angles.pitch.radians, message).to.equal(expectedYPR[1]);
      expect(el.placement.angles.roll.radians, message).to.equal(expectedYPR[2]);
      expect(el.placement.bbox.isNull, message).to.equal(!expectValidBBox);
    }

    describe("inserts 3d element and round-trips through JSON", async () => {
      async function test(annotation?: TextAnnotation): Promise<void> {
        const el0 = createElement();
        if (annotation) {
          el0.setAnnotation(annotation);
        }

        expectPlacement(el0, false);
        expect(el0.toJSON().elementGeometryBuilderParams, "elementGeometryBuilderParams should be set by .toJSON()").not.to.be.undefined;
        console.log("Claudia Test > ", "elementGeometryBuilderParams", el0.toJSON().elementGeometryBuilderParams?.entryArray);

        let elId: string | undefined;
        try {
          elId = el0.insert();
        } catch (e: any) {
          console.log("Claudia Test > ", "unable to insert element", e?.errorNumber);
        }

        expect(Id64.isValidId64(elId!), "element should be inserted").to.be.true;

        const el1 = imodel.elements.getElement<TextAnnotation3d>(elId!);
        expect(el1, "element should exist in the iModel").not.to.be.undefined;
        expect(el1 instanceof TextAnnotation3d, "element class should match what was inserted").to.be.true;

        expectPlacement(el1, undefined !== annotation && !annotation.textBlock.isEmpty);

        const anno = el1.getAnnotation();

        if (!annotation) {
          expect(anno, "If no annotation was provided, none should have been inserted to the JSON properties").to.be.undefined;
        } else {
          expect(anno, "If an annotation was provided, it should be decoded from the JSON properties").not.to.be.undefined;
          expect(anno!.equals(annotation), "and is this where we're failin?").to.be.true;
        }
      }

      it("roundtrips an empty annotation", async () => { await test(); });
      it("roundtrips an annotation with a style", async () => { await test(TextAnnotation.fromJSON({ textBlock: { styleName: "block" } })); });
      it("roundtrips an annotation with a textBlock", async () => { await test(createAnnotation()); });
    });
  });

  describe("TextAnnotation2d Persistence", () => {
    let imodel: SnapshotDb;
    let seed: GeometricElement2d;

    before(() => {
      const seedFileName = IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim");
      const testFileName = IModelTestUtils.prepareOutputFile("GeometryStream", "GeometryStreamTest.bim");
      imodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);

      seed = imodel.elements.getElement<GeometricElement2d>("0x25");
      assert.exists(seed);
      assert.isTrue(seed.federationGuid! === "153f5fa8-c414-491e-aa41-d6a886c098ae");
    });

    after(() => imodel.close());

    function createElement(props?: Partial<TextAnnotation2dProps>): TextAnnotation2d {
      return TextAnnotation2d.fromJSON({
        category: seed.category,
        model: seed.model,
        code: {
          spec: seed.code.spec,
          scope: seed.code.scope,
        },
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
      const el = createElement({ jsonProperties: { annotation: annotation.toJSON() } });
      expect(el.getAnnotation()!.equals(annotation)).to.be.true;
      expect(el.geom).to.be.undefined;
    });

    function expectPlacement(el: GeometricElement2d, expectValidBBox: boolean, expectedOrigin = [0, 0, 0], expectedYPR = [0, 0, 0]): void {
      const message = "placement should be equal";
      expect(el.placement.origin.x, message).to.equal(expectedOrigin[0]);
      expect(el.placement.origin.y, message).to.equal(expectedOrigin[1]);
      expect(el.placement.angle.degrees, message).to.equal(expectedYPR[0]);
      expect(el.placement.bbox.isNull, message).to.equal(!expectValidBBox);
    }

    describe.only("inserts 2d element and round-trips through JSON", async () => {
      async function test(annotation?: TextAnnotation): Promise<void> {
        const el0 = createElement();
        if (annotation) {
          el0.setAnnotation(annotation);
        }

        expectPlacement(el0, false);
        expect(el0.toJSON().elementGeometryBuilderParams, "elementGeometryBuilderParams should be set by .toJSON()").not.to.be.undefined;
        console.log("Claudia Test > ", "elementGeometryBuilderParams", el0.toJSON().elementGeometryBuilderParams?.entryArray);

        let elId: string | undefined;
        try {
          elId = el0.insert();
        } catch (e: any) {
          console.log("Claudia Test > ", "unable to insert element", e);
        }

        expect(Id64.isValidId64(elId!), "element should be inserted").to.be.true;

        const el1 = imodel.elements.getElement<TextAnnotation2d>(elId!);
        expect(el1, "element should exist in the iModel").not.to.be.undefined;
        expect(el1 instanceof TextAnnotation2d, "element class should match what was inserted").to.be.true;

        expectPlacement(el1, undefined !== annotation && !annotation.textBlock.isEmpty);

        const anno = el1.getAnnotation();

        if (!annotation) {
          expect(anno, "If no annotation was provided, none should have been inserted to the JSON properties").to.be.undefined;
        } else {
          expect(anno, "If an annotation was provided, it should be decoded from the JSON properties").not.to.be.undefined;
          expect(anno!.equals(annotation), "and is this where we're failin?").to.be.true;
        }
      }

      it("roundtrips an empty annotation", async () => { await test(); });
      it("roundtrips an annotation with a style", async () => { await test(TextAnnotation.fromJSON({ textBlock: { styleName: "block" } })); });
      it("roundtrips an annotation with a textBlock", async () => { await test(createAnnotation()); });
    });
  });
});
