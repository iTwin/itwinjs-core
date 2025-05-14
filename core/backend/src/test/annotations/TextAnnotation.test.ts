/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { Range2d } from "@itwin/core-geometry";
import { TextAnnotation, TextAnnotation2dProps, TextAnnotation3dProps, TextBlock, TextRun } from "@itwin/core-common";
import { IModelDb, SnapshotDb } from "../../IModelDb";
import { TextAnnotation2d, TextAnnotation3d } from "../../annotations/TextAnnotationElement";
import { IModelTestUtils } from "../IModelTestUtils";
import { GeometricElement3d } from "../../Element";
import { Id64 } from "@itwin/core-bentley";

function makeTextRun(content: string, styleName = ""): TextRun {
  return TextRun.create({ content, styleName });
}

function mockIModel(): IModelDb {
  const iModel: Pick<IModelDb, "fonts" | "computeRangesForText" | "forEachMetaData"> = {
    fonts: {
      findId: () => 0,
    } as any,
    computeRangesForText: () => { return { layout: new Range2d(0, 0, 1, 1), justification: new Range2d(0, 0, 1, 1) }; },
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
    it("updates JSON properties and recomputes geometry stream", () => {
      const elem = makeElement();
      expect(elem.geom).to.be.undefined;

      const textBlock = TextBlock.create({ styleName: "block" });
      textBlock.appendRun(TextRun.create({ content: "text", styleName: "run" }));
      const annotation = { textBlock: textBlock.toJSON() };
      elem.setAnnotation(TextAnnotation.fromJSON(annotation));

      expect(elem.geom).not.to.be.undefined;
      expect(elem.jsonProperties.annotation).to.deep.equal(annotation);
      expect(elem.jsonProperties.annotation).not.to.equal(annotation);
    });

    it("uses default subcategory by default", () => {
      const elem = makeElement();
      elem.setAnnotation(TextAnnotation.fromJSON({ textBlock: { styleName: "block" } }));
      expect(elem.geom!.length).to.equal(1);
      expect(elem.geom![0].appearance!.subCategory).to.equal("0x13");
    });

    it("uses specific subcategory if provided", () => {
      const elem = makeElement();
      elem.setAnnotation(TextAnnotation.fromJSON({ textBlock: { styleName: "block" } }));
      expect(elem.geom!.length).to.equal(1);
      expect(elem.geom![0].appearance!.subCategory).to.equal("0x1234");
    });
  });

  describe("persistence", () => {
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
        ...props,
        classFullName: TextAnnotation3d.classFullName,
      }, imodel);
    }

    function createAnnotation(): TextAnnotation {
      const block = TextBlock.createEmpty();
      block.styleName = "block";
      block.appendRun(makeTextRun("run", "run1"));
      block.appendRun(makeTextRun("RUN!!!!!", "run2"));

      return TextAnnotation.fromJSON({
        textBlock: block.toJSON(),
        anchor: {
          vertical: "middle",
          horizontal: "right",
        },
        orientation: { yaw: 1, pitch: 0, roll: -1 },
        offset: [0, -5, 100],
      });
    }

    it("create method does not automatically compute the geometry", () => {
      const annotation = createAnnotation();
      const el = createElement({ jsonProperties: { annotation: annotation.toJSON() } });
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

    it("inserts and round-trips through JSON", () => {
      function test(annotation?: TextAnnotation): void {
        const el0 = createElement();
        if (annotation) {
          el0.setAnnotation(annotation);
        }

        expectPlacement(el0, false);

        const elId = el0.insert();
        expect(Id64.isValidId64(elId)).to.be.true;

        const el1 = imodel.elements.getElement<TextAnnotation3d>(elId);
        expect(el1).not.to.be.undefined;
        expect(el1 instanceof TextAnnotation3d).to.be.true;

        expectPlacement(el1, undefined !== annotation && !annotation.textBlock.isEmpty);

        const anno = el1.getAnnotation();

        if (!annotation) {
          expect(anno).to.be.undefined;
        } else {
          expect(anno).not.to.be.undefined;
          expect(anno!.equals(annotation)).to.be.true;
        }
      }

      test();
      test(TextAnnotation.fromJSON({ textBlock: { styleName: "block" } }));
      test(createAnnotation());
    });
  });
});
