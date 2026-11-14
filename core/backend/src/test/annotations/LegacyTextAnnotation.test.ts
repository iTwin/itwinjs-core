/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Guid, Id64String, IModelStatus, OpenMode } from "@itwin/core-bentley";
import { Angle, Point3d, Range2d, Transform } from "@itwin/core-geometry";
import { FontType, IModel, IModelError, LeaderAttachment, SubCategoryAppearance, TextAnnotation, TextAnnotationProps, TextStyleSettingsProps } from "@itwin/core-common";
import {
  convertLegacyTextAnnotationJson, LegacyColor, LegacyFrame, LegacyLeader, LegacyRun, LegacyTextAnnotationJson, LegacyTextStyle,
} from "../../internal/annotations/legacyTextAnnotation";
import { LegacyTextAnnotationConversion, TextAnnotation2d, TextAnnotation3d } from "../../annotations/TextAnnotationElement";
import { computeFrame } from "../../annotations/FrameGeometry";
import { StandaloneDb } from "../../IModelDb";
import { withEditTxn } from "../../EditTxn";
import { ChannelControl } from "../../ChannelControl";
import { FontFile } from "../../FontFile";
import { DrawingCategory, SpatialCategory } from "../../Category";
import { Drawing } from "../../Element";
import { _nativeDb } from "../../internal/Symbols";
import { IModelTestUtils } from "../IModelTestUtils";
import {
  encodeFrameStyle, encodeLeaderStyle, encodeTextAnnotation, encodeTextStyle, FrameStyleKey, insertLegacyStyle, insertLegacyTextAnnotationData,
  LeaderStyleKey, LegacyColorType, LegacyFrameType, LegacyLeaderLineType, LegacyRunFixture, LegacySetters, LegacyStackedFractionType,
  LegacyTerminatorType, LegacyTextAnnotationFixture, TextStyleKey,
} from "./LegacyTextAnnotationFixture";

function legacyStyle(overrides: Partial<LegacyTextStyle> = {}): LegacyTextStyle {
  return {
    color: { type: "byCategory" },
    font: { name: "Karla", type: "truetype" },
    height: 2,
    lineSpacingFactor: 0.25,
    widthFactor: 1,
    isBold: false,
    isItalic: false,
    isUnderlined: false,
    stackedFractionScale: 0.7,
    stackedFractionType: "horizontal",
    subScriptOffsetFactor: -0.15,
    subScriptScale: 0.6,
    superScriptOffsetFactor: 0.5,
    superScriptScale: 0.6,
    ...overrides,
  };
}

function textRun(content: string, style = legacyStyle(), subSuperScript: "none" | "sub" | "super" = "none"): LegacyRun {
  return { type: "text", content, subSuperScript, style };
}

function makeJson(json: Partial<LegacyTextAnnotationJson> = {}): LegacyTextAnnotationJson {
  return { version: 1, leaders: [], issues: [], ...json };
}

function textJson(runs: LegacyRun[] = [textRun("Hello")], json: Partial<LegacyTextAnnotationJson> = {}): LegacyTextAnnotationJson {
  return makeJson({ textBlock: { documentWidth: 0, justification: "left", paragraphs: [{ runs }] }, ...json });
}

function legacyFrame(overrides: Partial<LegacyFrame> = {}): LegacyFrame {
  return {
    type: "box",
    horizontalPadding: 0.5,
    verticalPadding: 0.25,
    isFillEnabled: false,
    fillColor: { type: "byCategory" },
    fillTransparency: 0,
    isStrokeEnabled: true,
    isStrokeCloud: false,
    strokeColor: { type: "byCategory" },
    strokeWeight: 0,
    cloudBulgeFactor: 0,
    cloudDiameterFactor: 0,
    ...overrides,
  };
}

function legacyLeader(overrides: Partial<LegacyLeader> = {}): LegacyLeader {
  return {
    sourceAttachment: { type: "byId", id: 0 },
    targetPoint: [10, -5, 0],
    lineType: "straight",
    lineColor: { type: "byCategory" },
    lineWeight: 0,
    terminatorType: "closedArrow",
    terminatorColor: { type: "byCategory" },
    terminatorWeight: 0,
    terminatorScaleFactor: 0.75,
    ...overrides,
  };
}

function convert(json: LegacyTextAnnotationJson, scaleFactor?: number): LegacyTextAnnotationConversion {
  const result = convertLegacyTextAnnotationJson({ json, scaleFactor });
  // The result must always be valid TextAnnotationProps.
  expect(() => TextAnnotation.fromJSON(result.textAnnotation)).not.to.throw();
  return result;
}

function blockStyle(props: TextAnnotationProps): TextStyleSettingsProps {
  return props.textBlock!.styleOverrides!;
}

function issueCodes(result: LegacyTextAnnotationConversion): string[] {
  return result.issues.map((issue) => issue.code);
}

describe("convertLegacyTextAnnotationJson", () => {
  it("throws for an unsupported JSON version", () => {
    expect(() => convertLegacyTextAnnotationJson({ json: makeJson({ version: 2 }) })).to.throw("Unsupported legacy text annotation JSON version 2");
  });

  it("converts an annotation without text", () => {
    const result = convert(makeJson());
    expect(result.issues).to.deep.equal([]);
    expect(result.textAnnotation.textBlock!.children).to.deep.equal([]);
    expect(result.textAnnotation.leaders).to.be.undefined;
    expect(result.textAnnotation.offset).to.be.undefined;
  });

  it("hoists the first run's style into the text block's style overrides", () => {
    const style = legacyStyle({ color: { type: "rgba", value: 0x0000ff }, isItalic: true, lineSpacingFactor: 0.4, widthFactor: 0.8 });
    const result = convert(textJson([textRun("Hello", style)], { textBlock: { documentWidth: 0, justification: "center", paragraphs: [{ runs: [textRun("Hello", style)] }] } }));

    expect(result.issues).to.deep.equal([]);
    expect(result.textAnnotation.anchor).to.deep.equal({ vertical: "top", horizontal: "left" });
    expect(result.textAnnotation.textBlock!.width).to.be.undefined;
    expect(blockStyle(result.textAnnotation)).to.deep.equal({
      color: 0x0000ff,
      font: { name: "Karla", type: FontType.TrueType },
      textHeight: 2,
      isBold: false,
      isItalic: true,
      isUnderlined: false,
      stackedFractionScale: 0.7,
      stackedFractionType: "horizontal",
      subScriptOffsetFactor: -0.15,
      subScriptScale: 0.6,
      superScriptOffsetFactor: 0.5,
      superScriptScale: 0.6,
      lineSpacingFactor: 0.4,
      paragraphSpacingFactor: 0.4,
      widthFactor: 0.8,
      justification: "center",
    });

    expect(result.textAnnotation.textBlock!.children).to.deep.equal([{ children: [{ type: "text", content: "Hello" }] }]);
  });

  it("expresses run styles as differences from the block style", () => {
    const base = legacyStyle();
    const result = convert(makeJson({
      textBlock: {
        documentWidth: 0,
        justification: "left",
        paragraphs: [
          {
            runs: [
              textRun("plain", base),
              textRun("bold red", legacyStyle({ isBold: true, color: { type: "rgba", value: 0x0000ff } })),
              textRun("sub", base, "sub"),
              textRun("super", legacyStyle({ height: 1 }), "super"),
              { type: "lineBreak", style: base },
              { type: "fraction", numerator: "1", denominator: "2", style: legacyStyle({ stackedFractionType: "diagonal" }) },
            ],
          },
          { runs: [textRun("shx", legacyStyle({ font: { name: "Cdm", type: "shx" } })), textRun("rsc", legacyStyle({ font: { name: "Engineering", type: "rsc" } }))] },
        ],
      },
    }));

    expect(result.issues).to.deep.equal([]);
    expect(result.textAnnotation.textBlock!.children).to.deep.equal([
      {
        children: [
          { type: "text", content: "plain" },
          { type: "text", content: "bold red", styleOverrides: { color: 0x0000ff, isBold: true } },
          { type: "text", content: "sub", baselineShift: "subscript" },
          { type: "text", content: "super", baselineShift: "superscript", styleOverrides: { textHeight: 1 } },
          { type: "linebreak" },
          { type: "fraction", numerator: "1", denominator: "2", styleOverrides: { stackedFractionType: "diagonal" } },
        ],
      },
      {
        children: [
          { type: "text", content: "shx", styleOverrides: { font: { name: "Cdm", type: FontType.Shx } } },
          { type: "text", content: "rsc", styleOverrides: { font: { name: "Engineering", type: FontType.Rsc } } },
        ],
      },
    ]);
  });

  it("omits the font and reports it if the legacy font is missing", () => {
    const result = convert(textJson([textRun("a", legacyStyle({ font: undefined }))], { issues: [{ code: "missingFont", message: "font 7 not found", path: "textBlock.paragraphs[0].runs[0]" }] }));
    expect(blockStyle(result.textAnnotation).font).to.be.undefined;
    expect(result.issues.map((issue) => [issue.code, issue.path])).to.deep.equal([
      ["missingFont", "textBlock.paragraphs[0].runs[0]"],
      ["noFont", "textBlock"],
    ]);

    // Only the first run's font determines whether the block has a font.
    const laterRun = convert(textJson([textRun("a"), textRun("b", legacyStyle({ font: undefined }))]));
    expect(laterRun.issues.map((issue) => issue.code)).not.to.include("noFont");
  });

  it("reports runs whose block-level settings differ from the first run", () => {
    const result = convert(textJson([textRun("a"), textRun("b", legacyStyle({ lineSpacingFactor: 1 })), textRun("c", legacyStyle({ widthFactor: 2 }))]));
    expect(result.issues.map((issue) => [issue.code, issue.path])).to.deep.equal([
      ["blockLevelStyleVaries", "textBlock.paragraphs[0].runs[1]"],
      ["blockLevelStyleVaries", "textBlock.paragraphs[0].runs[2]"],
    ]);

    // Block-level settings are not run-level overrides.
    for (const run of result.textAnnotation.textBlock!.children![0].children!)
      expect(run.styleOverrides).to.be.undefined;
  });

  it("converts text colors", () => {
    const colors: LegacyColor[] = [{ type: "byCategory" }, { type: "rgba", value: 0x12345678 }, { type: "viewBackground" }];
    const result = convert(textJson(colors.map((color, i) => textRun(`${i}`, legacyStyle({ color })))));
    expect(blockStyle(result.textAnnotation).color).to.equal("subcategory");
    const runs = result.textAnnotation.textBlock!.children![0].children!;
    expect(runs[1].styleOverrides).to.deep.equal({ color: 0x12345678 });
    expect(runs[2].styleOverrides).to.be.undefined;
    expect(result.issues.map((issue) => [issue.code, issue.path])).to.deep.equal([["viewBackgroundColor", "textBlock.paragraphs[0].runs[2]"]]);

    const first = convert(textJson([textRun("a", legacyStyle({ color: { type: "viewBackground" } }))]));
    expect(first.issues.map((issue) => [issue.code, issue.path])).to.deep.equal([["viewBackgroundColor", "textBlock"]]);
  });

  it("converts sizes relative to the drawing's scale factor", () => {
    const json = textJson([textRun("a"), textRun("b", legacyStyle({ height: 4 }))]);
    json.textBlock!.documentWidth = 100;

    const unscaled = convert(json);
    expect(blockStyle(unscaled.textAnnotation).textHeight).to.equal(2);
    expect(unscaled.textAnnotation.textBlock!.width).to.equal(100);

    const scaled = convert(json, 50);
    expect(blockStyle(scaled.textAnnotation).textHeight).to.equal(2 / 50);
    expect(scaled.textAnnotation.textBlock!.width).to.equal(100 / 50);
    expect(scaled.textAnnotation.textBlock!.children![0].children![1].styleOverrides).to.deep.equal({ textHeight: 4 / 50 });
  });

  it("passes native issues through", () => {
    const issues = [
      { code: "missingTextStyle", message: "Text style 0x1f not found", path: "textBlock.paragraphs[0].runs[0]" },
      { code: "layoutFailed", message: "Layout failed" },
    ];
    const json = textJson(undefined, { issues });
    const result = convert(json);
    expect(result.issues).to.deep.equal(issues);
    expect(result.issues).not.to.equal(json.issues);
  });

  it("offsets the annotation so that the text keeps its legacy position", () => {
    const layout: LegacyTextAnnotationJson["layout"] = { textRange: { low: [0.5, -3], high: [8, 1] }, leaderSourcePoints: [] };
    const noFrame = convert(textJson(undefined, { layout }));
    expect(noFrame.textAnnotation.offset).to.deep.equal([0.5, 1, 0]);

    // The modern anchor is the corner of the text range expanded by the margins.
    const framed = convert(textJson(undefined, { layout, frame: legacyFrame({ horizontalPadding: 0.5, verticalPadding: 0.25 }) }));
    expect(framed.textAnnotation.offset).to.deep.equal([0.5 - 0.5 * 2, 1 + 0.25 * 2, 0]);

    const atOrigin = convert(textJson(undefined, { layout: { textRange: { low: [0, -3], high: [8, 0] }, leaderSourcePoints: [] } }));
    expect(atOrigin.textAnnotation.offset).to.be.undefined;
  });

  describe("frames", () => {
    function convertFrame(frame: LegacyFrame): LegacyTextAnnotationConversion {
      return convert(textJson(undefined, { frame }));
    }

    it("converts frame shapes and margins", () => {
      const box = convertFrame(legacyFrame({ type: "box", isFillEnabled: true, fillColor: { type: "rgba", value: 0xff }, strokeColor: { type: "rgba", value: 0xff00 }, strokeWeight: 3 }));
      expect(box.issues).to.deep.equal([]);
      expect(blockStyle(box.textAnnotation).frame).to.deep.equal({ shape: "rectangle", fillColor: 0xff, borderColor: 0xff00, borderWeight: 3 });
      expect(blockStyle(box.textAnnotation).margins).to.deep.equal({ left: 0.5, right: 0.5, top: 0.25, bottom: 0.25 });

      const circle = convertFrame(legacyFrame({ type: "circle" }));
      expect(circle.issues).to.deep.equal([]);
      expect(blockStyle(circle.textAnnotation).frame).to.deep.equal({ shape: "circle", fillColor: "none", borderColor: "subcategory", borderWeight: 0 });

      const ellipse = convertFrame(legacyFrame({ type: "ellipse" }));
      expect(issueCodes(ellipse)).to.deep.equal(["frameEllipse"]);
      expect(blockStyle(ellipse.textAnnotation).frame!.shape).to.equal("circle");

      const invisible = convertFrame(legacyFrame({ type: "invisibleBox", isFillEnabled: true }));
      expect(invisible.issues).to.deep.equal([]);
      expect(blockStyle(invisible.textAnnotation).frame).to.deep.equal({ shape: "none" });
      expect(blockStyle(invisible.textAnnotation).margins).to.deep.equal({ left: 0.5, right: 0.5, top: 0.25, bottom: 0.25 });
    });

    it("ignores negative padding", () => {
      const result = convertFrame(legacyFrame({ horizontalPadding: -1, verticalPadding: -2 }));
      expect(blockStyle(result.textAnnotation).margins).to.deep.equal({ left: 0, right: 0, top: 0, bottom: 0 });
    });

    it("omits frames with neither fill nor outline", () => {
      const result = convertFrame(legacyFrame({ isFillEnabled: false, isStrokeEnabled: false }));
      expect(result.issues).to.deep.equal([]);
      expect(blockStyle(result.textAnnotation).frame).to.deep.equal({ shape: "none" });
    });

    it("reports unsupported frame features", () => {
      const result = convertFrame(legacyFrame({ isFillEnabled: true, fillTransparency: 0.5, isStrokeEnabled: false, isStrokeCloud: true }));
      expect(issueCodes(result)).to.deep.equal(["frameFillTransparency", "frameStrokeDisabled"]);

      const cloud = convertFrame(legacyFrame({ isStrokeCloud: true, strokeColor: { type: "viewBackground" } }));
      expect(issueCodes(cloud)).to.deep.equal(["frameCloud", "viewBackgroundColor"]);
      expect(blockStyle(cloud.textAnnotation).frame!.borderColor).to.equal("subcategory");
    });

    it("converts fill colors", () => {
      const background = convertFrame(legacyFrame({ isFillEnabled: true, fillColor: { type: "viewBackground" } }));
      expect(background.issues).to.deep.equal([]);
      expect(blockStyle(background.textAnnotation).frame!.fillColor).to.equal("background");

      const byCategory = convertFrame(legacyFrame({ isFillEnabled: true, fillColor: { type: "byCategory" } }));
      expect(blockStyle(byCategory.textAnnotation).frame!.fillColor).to.equal("subcategory");
    });
  });

  describe("leaders", () => {
    function convertLeaders(leaders: LegacyLeader[], frame: LegacyFrame = legacyFrame()): LegacyTextAnnotationConversion {
      return convert(textJson(undefined, { frame, leaders }));
    }

    it("converts leaders", () => {
      const result = convertLeaders([legacyLeader({ lineColor: { type: "rgba", value: 0xff }, terminatorColor: { type: "rgba", value: 0xff } })]);
      expect(result.issues).to.deep.equal([]);
      expect(result.textAnnotation.leaders).to.deep.equal([{
        startPoint: [10, -5, 0],
        attachment: { mode: "KeyPoint", curveIndex: 1, fraction: 0.5 },
        styleOverrides: {
          leader: {
            color: 0xff,
            wantElbow: false,
            terminatorShape: "closedArrow",
            terminatorHeightFactor: 0.75,
            terminatorWidthFactor: 0.75,
            showLeaders: true,
            showTerminators: true,
            showTargetPoint: false,
          },
        },
      }]);
    });

    it("converts terminators", () => {
      const result = convertLeaders([legacyLeader({ terminatorType: "openArrow" }), legacyLeader({ terminatorType: "none", terminatorColor: { type: "rgba", value: 1 }, terminatorWeight: 4 })]);
      expect(result.issues).to.deep.equal([]);
      const styles = result.textAnnotation.leaders!.map((leader) => leader.styleOverrides!.leader!);
      expect(styles.map((style) => [style.terminatorShape, style.showTerminators])).to.deep.equal([["openArrow", true], ["none", false]]);
    });

    it("reports unsupported leader features", () => {
      const result = convertLeaders([
        legacyLeader({ lineType: "curved" }),
        legacyLeader({ lineType: "none" }),
        legacyLeader({ lineType: "none", terminatorType: "none" }),
        legacyLeader({ terminatorColor: { type: "rgba", value: 0xff } }),
        legacyLeader({ lineWeight: 2 }),
        legacyLeader({ terminatorWeight: 2 }),
        legacyLeader({ lineColor: { type: "viewBackground" }, terminatorColor: { type: "viewBackground" } }),
      ]);

      expect(result.issues.map((issue) => [issue.code, issue.path])).to.deep.equal([
        ["leaderCurved", "leaders[0]"],
        ["leaderTerminatorWithoutLine", "leaders[1]"],
        ["leaderTerminatorColor", "leaders[3]"],
        ["leaderWeight", "leaders[4]"],
        ["leaderWeight", "leaders[5]"],
        ["viewBackgroundColor", "leaders[6]"],
      ]);

      const styles = result.textAnnotation.leaders!.map((leader) => leader.styleOverrides!.leader!);
      expect(styles.map((style) => style.showLeaders)).to.deep.equal([true, false, false, true, true, true, true]);
    });

    it("omits leaders if there is no frame", () => {
      const result = convert(textJson(undefined, { leaders: [legacyLeader(), legacyLeader()] }));
      expect(result.textAnnotation.leaders).to.be.undefined;
      expect(result.issues.map((issue) => [issue.code, issue.path])).to.deep.equal([["leaderWithoutFrame", "leaders[0]"], ["leaderWithoutFrame", "leaders[1]"]]);
    });

    function attachmentPoint(attachment: LeaderAttachment | undefined, frame: "rectangle" | "circle", range: Range2d): Point3d {
      expect(attachment?.mode).to.equal("KeyPoint");
      if (attachment?.mode !== "KeyPoint")
        throw new Error("Expected a KeyPoint attachment");

      const curves = computeFrame({ frame, range, transform: Transform.createIdentity() }).collectCurvePrimitives(undefined, false, true);
      return curves[attachment.curveIndex].fractionToPoint(attachment.fraction);
    }

    function attachmentPoints(frame: LegacyFrame, ids: number[], modernFrame: "rectangle" | "circle", range: Range2d): Array<[number, number]> {
      const result = convertLeaders(ids.map((id) => legacyLeader({ sourceAttachment: { type: "byId", id } })), frame);
      return result.textAnnotation.leaders!.map((leader) => {
        const point = attachmentPoint(leader.attachment, modernFrame, range);
        return [Math.round(point.x * 1000) / 1000, Math.round(point.y * 1000) / 1000];
      });
    }

    it("attaches leaders to the corresponding point on a rectangular frame", () => {
      const range = new Range2d(0, 0, 4, 2);
      const expected = [[4, 1], [4, 2], [2, 2], [0, 2], [0, 1], [0, 0], [2, 0], [4, 0], [4, 0], [4, 1]];
      expect(attachmentPoints(legacyFrame({ type: "box" }), [0, 1, 2, 3, 4, 5, 6, 7, 8, -1], "rectangle", range)).to.deep.equal(expected);
      expect(attachmentPoints(legacyFrame({ type: "invisibleBox" }), [0, 1, 2, 3, 4, 5, 6, 7, 8, -1], "rectangle", range)).to.deep.equal(expected);
    });

    it("attaches leaders to the corresponding point on a circular frame", () => {
      const range = new Range2d(-1, -1, 1, 1);
      const r = Math.round(Math.SQRT2 * 1000) / 1000;
      const expected = [[r, 0], [0, r], [-r, 0], [0, -r], [0, -r]];
      expect(attachmentPoints(legacyFrame({ type: "circle" }), [0, 1, 2, 3, 4], "circle", range).map(([x, y]) => [x + 0, y + 0])).to.deep.equal(expected);
      expect(attachmentPoints(legacyFrame({ type: "ellipse" }), [0, 1, 2, 3, 4], "circle", range).map(([x, y]) => [x + 0, y + 0])).to.deep.equal(expected);
    });
  });
});

describe("TextAnnotation.readLegacyTextAnnotation", () => {
  let imodel: StandaloneDb;
  let category: Id64String;
  let drawingModel: Id64String;
  let scaledDrawingModel: Id64String;
  let element2d: Id64String;
  let scaledElement2d: Id64String;

  type NativeFunc = (id: Id64String) => LegacyTextAnnotationJson | undefined;

  function stubNative(func: NativeFunc): void {
    // The native method is read-only, so shadow it with an own property.
    Object.defineProperty(imodel[_nativeDb], "readLegacyTextAnnotation", { value: func, configurable: true, writable: true });
  }

  before(async () => {
    const filePath = IModelTestUtils.prepareOutputFile("annotationTests", "LegacyTextAnnotation.bim");
    imodel = StandaloneDb.createEmpty(filePath, {
      rootSubject: { name: "LegacyTextAnnotation tests" },
      client: "integration tests",
      globalOrigin: { x: 0, y: 0 },
      projectExtents: { low: { x: -500, y: -500, z: -50 }, high: { x: 500, y: 500, z: 50 } },
      guid: Guid.createValue(),
    });

    await withEditTxn(imodel, async (txn) => {
      await imodel.fonts.embedFontFile({ file: FontFile.createFromTrueTypeFileName(IModelTestUtils.resolveFontFile("Karla-Regular.ttf")) });
      category = DrawingCategory.insert(txn, IModel.dictionaryId, "Legacy", new SubCategoryAppearance());
      drawingModel = IModelTestUtils.createAndInsertDrawingPartitionAndModel(txn, { spec: "0x1", scope: "0x1", value: "Unscaled" })[1];
      const [scaledDrawing, scaledModel] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(txn, { spec: "0x1", scope: "0x1", value: "Scaled" });
      scaledDrawingModel = scaledModel;
      const drawing = imodel.elements.getElement<Drawing>(scaledDrawing);
      drawing.scaleFactor = 50;
      txn.updateElement(drawing.toJSON());

      const placement = { origin: { x: 0, y: 0 }, angle: Angle.createDegrees(0).toJSON() };
      element2d = TextAnnotation2d.create(imodel, { category, model: drawingModel, placement }).insert(txn);
      scaledElement2d = TextAnnotation2d.create(imodel, { category, model: scaledDrawingModel, placement }).insert(txn);
    });
  });

  afterEach(() => {
    delete (imodel[_nativeDb] as { readLegacyTextAnnotation?: NativeFunc }).readLegacyTextAnnotation;
  });

  after(() => imodel.close());

  function expectIModelError(func: () => void, status: IModelStatus): void {
    try {
      func();
    } catch (err) {
      expect(err).to.be.instanceOf(IModelError);
      expect((err as IModelError).errorNumber).to.equal(status);
      return;
    }

    expect.fail("Expected an IModelError");
  }

  it("throws if the element is not of the expected class", () => {
    stubNative(() => textJson());
    expectIModelError(() => TextAnnotation3d.readLegacyTextAnnotation(imodel, element2d), IModelStatus.WrongClass);
    expectIModelError(() => TextAnnotation2d.readLegacyTextAnnotation(imodel, category), IModelStatus.WrongClass);
  });

  it("throws if the element does not exist", () => {
    stubNative(() => textJson());
    expect(() => TextAnnotation2d.readLegacyTextAnnotation(imodel, "0xbadf00d")).to.throw();
  });

  it("returns undefined if the element has no legacy content", () => {
    const requested: Id64String[] = [];
    stubNative((id) => { requested.push(id); return undefined; });
    expect(TextAnnotation2d.readLegacyTextAnnotation(imodel, element2d)).to.be.undefined;
    expect(requested).to.deep.equal([element2d]);
  });

  it("applies the drawing's scale factor", () => {
    stubNative(() => textJson());
    expect(blockStyle(TextAnnotation2d.readLegacyTextAnnotation(imodel, element2d)!.textAnnotation).textHeight).to.equal(2);
    expect(blockStyle(TextAnnotation2d.readLegacyTextAnnotation(imodel, scaledElement2d)!.textAnnotation).textHeight).to.equal(2 / 50);
  });

  it("produces an annotation that can be written to an element", () => {
    const json = textJson(
      [textRun("Hello "), textRun("world", legacyStyle({ isBold: true })), { type: "lineBreak", style: legacyStyle() }, { type: "fraction", numerator: "1", denominator: "2", style: legacyStyle() }],
      {
        frame: legacyFrame({ isFillEnabled: true }),
        leaders: [legacyLeader({ sourceAttachment: { type: "byId", id: 4 }, targetPoint: [-10, 0, 0] })],
        layout: { textRange: { low: [0, -5], high: [12, 0] }, leaderSourcePoints: [[-1, -2.5, 0]] },
      },
    );
    stubNative(() => json);

    const result = TextAnnotation2d.readLegacyTextAnnotation(imodel, element2d)!;
    expect(JSON.stringify(result.textAnnotation)).not.to.match(/0x[0-9a-f]+/i);

    const element = imodel.elements.getElement<TextAnnotation2d>(element2d);
    element.setAnnotation(TextAnnotation.fromJSON(result.textAnnotation));
    withEditTxn(imodel, (txn) => element.update(txn));

    const updated = imodel.elements.getElement<TextAnnotation2d>(element2d);
    expect(updated.getAnnotation()!.toJSON()).to.deep.equal(TextAnnotation.fromJSON(result.textAnnotation).toJSON());
    expect(updated.placement.bbox.isNull).to.be.false;
    // The leader extends left of the text to its target point.
    expect(updated.placement.bbox.low.x).to.be.lessThan(-9);
  });
});

describe("TextAnnotation.readLegacyTextAnnotation with legacy text annotation data", () => {
  let filePath: string;
  let imodel: StandaloneDb | undefined;
  const ids: Record<string, Id64String> = {};
  const db = () => imodel!;

  function read2d(name: string): LegacyTextAnnotationConversion {
    const result = TextAnnotation2d.readLegacyTextAnnotation(db(), ids[name]);
    expect(result).not.to.be.undefined;
    expect(() => TextAnnotation.fromJSON(result!.textAnnotation)).not.to.throw();
    // Legacy styles are resolved, so the annotation must not refer to any element.
    expect(JSON.stringify(result!.textAnnotation)).not.to.match(/0x[0-9a-f]+/i);
    return result!;
  }

  function readNativeJson(name: string): LegacyTextAnnotationJson | undefined {
    return db()[_nativeDb].readLegacyTextAnnotation(ids[name]);
  }

  before(async () => {
    filePath = IModelTestUtils.prepareOutputFile("annotationTests", "LegacyTextAnnotationData.bim");
    imodel = StandaloneDb.createEmpty(filePath, {
      rootSubject: { name: "LegacyTextAnnotationData tests" },
      client: "integration tests",
      globalOrigin: { x: 0, y: 0 },
      projectExtents: { low: { x: -500, y: -500, z: -50 }, high: { x: 500, y: 500, z: 50 } },
      guid: Guid.createValue(),
    });

    await imodel.fonts.embedFontFile({ file: FontFile.createFromTrueTypeFileName(IModelTestUtils.resolveFontFile("Karla-Regular.ttf")) });
    const fontId = await imodel.fonts.acquireId({ name: "Karla", type: FontType.TrueType });

    await withEditTxn(imodel, async (txn) => {
      const iModel = txn.iModel;
      const category = DrawingCategory.insert(txn, IModel.dictionaryId, "Legacy", new SubCategoryAppearance());
      const spatialCategory = SpatialCategory.insert(txn, IModel.dictionaryId, "Legacy3d", new SubCategoryAppearance());
      const drawingModel = IModelTestUtils.createAndInsertDrawingPartitionAndModel(txn, { spec: "0x1", scope: "0x1", value: "Unscaled" })[1];
      const [scaledDrawing, scaledDrawingModel] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(txn, { spec: "0x1", scope: "0x1", value: "Scaled50" });
      const drawing = iModel.elements.getElement<Drawing>(scaledDrawing);
      drawing.scaleFactor = 50;
      txn.updateElement(drawing.toJSON());
      const physicalModel = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(txn, { spec: "0x1", scope: "0x1", value: "LegacyText3d" })[1];

      const regularSetters: LegacySetters = [
        [TextStyleKey.colorType, LegacyColorType.byCategory], [TextStyleKey.fontId, fontId], [TextStyleKey.height, 2],
        [TextStyleKey.lineSpacingFactor, 0.5], [TextStyleKey.widthFactor, 1],
      ];
      const regular = insertLegacyStyle(txn, "AnnotationTextStyle", "Regular", encodeTextStyle(regularSetters));
      const diagonal = insertLegacyStyle(txn, "AnnotationTextStyle", "DiagonalFraction", encodeTextStyle([...regularSetters, [TextStyleKey.stackedFractionType, LegacyStackedFractionType.diagonal]]));
      const missingFont = insertLegacyStyle(txn, "AnnotationTextStyle", "MissingFont", encodeTextStyle([[TextStyleKey.fontId, 0x7fff], [TextStyleKey.height, 2]]));
      const box = insertLegacyStyle(txn, "AnnotationFrameStyle", "BoxFillStroke", encodeFrameStyle([
        [FrameStyleKey.type, LegacyFrameType.box], [FrameStyleKey.horizontalPadding, 0.5], [FrameStyleKey.verticalPadding, 0.25],
        [FrameStyleKey.isFillEnabled, 1], [FrameStyleKey.fillColorType, LegacyColorType.rgba], [FrameStyleKey.fillColorValue, 0x00ff00],
        [FrameStyleKey.isStrokeEnabled, 1], [FrameStyleKey.strokeColorType, LegacyColorType.byCategory], [FrameStyleKey.strokeWeight, 2],
      ]));
      const circle = insertLegacyStyle(txn, "AnnotationFrameStyle", "CircleStroke", encodeFrameStyle([
        [FrameStyleKey.type, LegacyFrameType.circle], [FrameStyleKey.horizontalPadding, 0.5], [FrameStyleKey.verticalPadding, 0.5],
        [FrameStyleKey.isStrokeEnabled, 1], [FrameStyleKey.strokeColorType, LegacyColorType.rgba], [FrameStyleKey.strokeColorValue, 0x0000ff],
      ]));
      const invisible = insertLegacyStyle(txn, "AnnotationFrameStyle", "InvisibleBox", encodeFrameStyle([
        [FrameStyleKey.type, LegacyFrameType.invisibleBox], [FrameStyleKey.horizontalPadding, 0.5], [FrameStyleKey.verticalPadding, 0.5],
      ]));
      const straight = insertLegacyStyle(txn, "AnnotationLeaderStyle", "StraightClosedArrow", encodeLeaderStyle([
        [LeaderStyleKey.lineType, LegacyLeaderLineType.straight], [LeaderStyleKey.lineColorType, LegacyColorType.byCategory],
        [LeaderStyleKey.terminatorType, LegacyTerminatorType.closedArrow], [LeaderStyleKey.terminatorColorType, LegacyColorType.byCategory],
        [LeaderStyleKey.terminatorScaleFactor, 0.75],
      ]));
      const curved = insertLegacyStyle(txn, "AnnotationLeaderStyle", "CurvedOpenArrow", encodeLeaderStyle([
        [LeaderStyleKey.lineType, LegacyLeaderLineType.curved], [LeaderStyleKey.lineColorType, LegacyColorType.byCategory],
        [LeaderStyleKey.terminatorType, LegacyTerminatorType.openArrow], [LeaderStyleKey.terminatorColorType, LegacyColorType.byCategory],
        [LeaderStyleKey.terminatorScaleFactor, 1],
      ]));

      const hello = (styleId = regular): LegacyRunFixture => ({ type: "text", styleId, content: "Hello" });
      const simpleDocument = (styleId = regular): LegacyTextAnnotationFixture["document"] => ({ styleId, paragraphs: [{ runs: [hello(styleId)] }] });

      const fixtures: Record<string, LegacyTextAnnotationFixture | undefined> = {
        mixedRuns: {
          document: {
            styleId: regular,
            paragraphs: [
              {
                runs: [
                  { type: "text", styleId: regular, content: "Hello " },
                  { type: "text", styleId: regular, content: "world", overrides: [[TextStyleKey.isBold, 1], [TextStyleKey.colorType, LegacyColorType.rgba], [TextStyleKey.colorValue, 0x0000ff]] },
                  { type: "text", styleId: regular, content: "2", subSuperScript: "super" },
                ],
              },
              {
                runs: [
                  { type: "fraction", styleId: diagonal, numerator: "1", denominator: "2" },
                  { type: "lineBreak", styleId: regular },
                  { type: "text", styleId: regular, content: "x", subSuperScript: "sub" },
                ],
              },
            ],
          },
        },
        documentWidthCenter: { document: { ...simpleDocument()!, documentWidth: 20, justification: "center" } },
        frameBox: {
          document: simpleDocument(),
          frame: { styleId: box },
          leaders: [
            { styleId: straight, attachmentId: 0, targetPoint: [30, -1, 0] },
            { styleId: straight, attachmentId: 4, targetPoint: [-20, -1, 0] },
            { styleId: straight, attachmentId: 6, targetPoint: [5, -20, 0] },
          ],
        },
        frameCircle: { document: simpleDocument(), frame: { styleId: circle }, leaders: [{ styleId: curved, attachmentId: 1, targetPoint: [5, 20, 0] }] },
        frameInvisibleBox: { document: simpleDocument(), frame: { styleId: invisible }, leaders: [{ styleId: straight, attachmentId: 2, targetPoint: [5, 20, 0] }] },
        leaderWithoutFrame: { document: simpleDocument(), leaders: [{ styleId: straight, attachmentId: 0, targetPoint: [30, -1, 0] }] },
        missingTextStyle: { document: simpleDocument("0xfffff") },
        missingFrameAndLeaderStyles: { document: simpleDocument(), frame: { styleId: "0xffffe" }, leaders: [{ styleId: "0xffffd", attachmentId: 0, targetPoint: [30, -1, 0] }] },
        missingFont: { document: simpleDocument(missingFont) },
        noAspect: undefined,
      };

      const placement = { origin: { x: 0, y: 0 }, angle: Angle.createDegrees(0).toJSON() };
      for (const [name, fixture] of Object.entries(fixtures)) {
        ids[name] = TextAnnotation2d.create(iModel, { category, model: drawingModel, placement }).insert(txn);
        if (fixture)
          insertLegacyTextAnnotationData(txn, ids[name], encodeTextAnnotation(fixture));
      }

      ids.scaledDrawing = TextAnnotation2d.create(iModel, { category, model: scaledDrawingModel, placement }).insert(txn);
      insertLegacyTextAnnotationData(txn, ids.scaledDrawing, encodeTextAnnotation({ document: { ...simpleDocument()!, documentWidth: 20, justification: "right" } }));

      ids.textAnnotation3d = TextAnnotation3d.create(iModel, { category: spatialCategory, model: physicalModel, placement: { origin: [0, 0, 0], angles: {} } }).insert(txn);
      insertLegacyTextAnnotationData(txn, ids.textAnnotation3d, encodeTextAnnotation({ document: simpleDocument() }));

      ids.corrupt = TextAnnotation2d.create(iModel, { category, model: drawingModel, placement }).insert(txn);
      insertLegacyTextAnnotationData(txn, ids.corrupt, new Uint8Array([1, 2, 3, 4, 5, 6, 7]));

      ids.tooNew = TextAnnotation2d.create(iModel, { category, model: drawingModel, placement }).insert(txn);
      insertLegacyTextAnnotationData(txn, ids.tooNew, encodeTextAnnotation({ document: simpleDocument(), majorVersion: 2 }));
    });

    // Reopen the iModel so that native code reads the legacy style data that was written directly to the database.
    imodel.close();
    imodel = StandaloneDb.openFile(filePath, OpenMode.ReadWrite);
    imodel.channels.addAllowedChannel(ChannelControl.sharedChannelName);
  });

  after(() => imodel?.close());

  it("returns undefined if the element has no legacy text annotation data", () => {
    expect(TextAnnotation2d.readLegacyTextAnnotation(db(), ids.noAspect)).to.be.undefined;
  });

  it("converts runs and their style overrides", () => {
    const { textAnnotation, issues } = read2d("mixedRuns");
    expect(issues).to.deep.equal([]);
    expect(textAnnotation.anchor).to.deep.equal({ vertical: "top", horizontal: "left" });
    expect(blockStyle(textAnnotation)).to.include({ color: "subcategory", textHeight: 2, lineSpacingFactor: 0.5, widthFactor: 1, justification: "left", isBold: false });
    expect(blockStyle(textAnnotation).font).to.deep.equal({ name: "Karla", type: FontType.TrueType });

    const paragraphs = textAnnotation.textBlock!.children!;
    expect(paragraphs.length).to.equal(2);
    expect(paragraphs[0].children).to.deep.equal([
      { type: "text", content: "Hello " },
      { type: "text", content: "world", styleOverrides: { isBold: true, color: 0x0000ff } },
      { type: "text", content: "2", baselineShift: "superscript" },
    ]);
    expect(paragraphs[1].children).to.deep.equal([
      { type: "fraction", numerator: "1", denominator: "2", styleOverrides: { stackedFractionType: "diagonal" } },
      { type: "linebreak" },
      { type: "text", content: "x", baselineShift: "subscript" },
    ]);
  });

  it("converts the document width and justification", () => {
    const { textAnnotation, issues } = read2d("documentWidthCenter");
    expect(issues).to.deep.equal([]);
    expect(textAnnotation.textBlock!.width).to.equal(20);
    expect(blockStyle(textAnnotation).justification).to.equal("center");
  });

  it("applies the drawing's scale factor", () => {
    const { textAnnotation, issues } = read2d("scaledDrawing");
    expect(issues).to.deep.equal([]);
    expect(blockStyle(textAnnotation).textHeight).to.equal(2 / 50);
    expect(textAnnotation.textBlock!.width).to.equal(20 / 50);
    expect(blockStyle(textAnnotation).justification).to.equal("right");
  });

  it("converts a box frame and its leaders", () => {
    const { textAnnotation, issues } = read2d("frameBox");
    expect(issues).to.deep.equal([]);
    expect(blockStyle(textAnnotation).frame).to.deep.equal({ shape: "rectangle", fillColor: 0x00ff00, borderColor: "subcategory", borderWeight: 2 });
    expect(blockStyle(textAnnotation).margins).to.deep.equal({ left: 0.5, right: 0.5, top: 0.25, bottom: 0.25 });

    const leaders = textAnnotation.leaders!;
    expect(leaders.map((leader) => leader.attachment)).to.deep.equal([
      { mode: "KeyPoint", curveIndex: 1, fraction: 0.5 },
      { mode: "KeyPoint", curveIndex: 3, fraction: 0.5 },
      { mode: "KeyPoint", curveIndex: 0, fraction: 0.5 },
    ]);
    expect(leaders.map((leader) => leader.startPoint)).to.deep.equal([[30, -1, 0], [-20, -1, 0], [5, -20, 0]]);
    expect(leaders[0].styleOverrides!.leader).to.include({ terminatorShape: "closedArrow", terminatorHeightFactor: 0.75, showLeaders: true, showTerminators: true });
  });

  it("offsets the anchor from the legacy text range by the frame's margins", () => {
    const json = readNativeJson("frameBox")!;
    expect(json.layout).not.to.be.undefined;
    const { textAnnotation } = read2d("frameBox");
    const textRange = json.layout!.textRange;
    // Margins are factors of the text height (2).
    expect(textAnnotation.offset).to.deep.equal([textRange.low[0] - 0.5 * 2, textRange.high[1] + 0.25 * 2, 0]);
  });

  it("reports content that cannot be converted exactly", () => {
    const circle = read2d("frameCircle");
    expect(blockStyle(circle.textAnnotation).frame).to.deep.equal({ shape: "circle", fillColor: "none", borderColor: 0x0000ff, borderWeight: 0 });
    expect(circle.textAnnotation.leaders![0].attachment).to.deep.equal({ mode: "KeyPoint", curveIndex: 0, fraction: 0.25 });
    expect(circle.textAnnotation.leaders![0].styleOverrides!.leader!.terminatorShape).to.equal("openArrow");
    expect(issueCodes(circle)).to.deep.equal(["leaderCurved"]);

    const invisible = read2d("frameInvisibleBox");
    expect(blockStyle(invisible.textAnnotation).frame).to.deep.equal({ shape: "none" });
    expect(blockStyle(invisible.textAnnotation).margins).to.deep.equal({ left: 0.5, right: 0.5, top: 0.5, bottom: 0.5 });
    expect(invisible.textAnnotation.leaders!.length).to.equal(1);
    expect(invisible.issues).to.deep.equal([]);

    const withoutFrame = read2d("leaderWithoutFrame");
    expect(withoutFrame.textAnnotation.leaders).to.be.undefined;
    expect(issueCodes(withoutFrame)).to.deep.equal(["leaderWithoutFrame"]);
  });

  it("reports missing styles and fonts", () => {
    const missingText = read2d("missingTextStyle");
    expect(issueCodes(missingText)).to.include.members(["missingTextStyle", "noFont"]);
    expect(missingText.textAnnotation.textBlock!.children![0].children).to.deep.equal([{ type: "text", content: "Hello" }]);
    expect(missingText.issues.find((issue) => issue.code === "missingTextStyle")!.path).not.to.be.undefined;

    const missingFrameAndLeader = read2d("missingFrameAndLeaderStyles");
    expect(issueCodes(missingFrameAndLeader)).to.include.members(["missingFrameStyle", "missingLeaderStyle"]);

    const missingFont = read2d("missingFont");
    expect(issueCodes(missingFont)).to.include.members(["missingFont", "noFont"]);
    expect(blockStyle(missingFont.textAnnotation).font).to.be.undefined;
  });

  it("converts a 3d annotation", () => {
    expectIModelErrorStatus(() => TextAnnotation2d.readLegacyTextAnnotation(db(), ids.textAnnotation3d), IModelStatus.WrongClass);
    const result = TextAnnotation3d.readLegacyTextAnnotation(db(), ids.textAnnotation3d)!;
    expect(result.issues).to.deep.equal([]);
    expect(blockStyle(result.textAnnotation).textHeight).to.equal(2);
    expect(result.textAnnotation.textBlock!.children![0].children).to.deep.equal([{ type: "text", content: "Hello" }]);
  });

  it("throws for corrupt or unsupported legacy data", () => {
    expect(() => TextAnnotation2d.readLegacyTextAnnotation(db(), ids.corrupt)).to.throw();
    expect(() => TextAnnotation2d.readLegacyTextAnnotation(db(), ids.tooNew)).to.throw();
  });

  it("produces annotations that can be written to the elements", () => {
    for (const name of ["mixedRuns", "frameBox", "frameCircle", "frameInvisibleBox"]) {
      const { textAnnotation } = read2d(name);
      const element = db().elements.getElement<TextAnnotation2d>(ids[name]);
      element.setAnnotation(TextAnnotation.fromJSON(textAnnotation));
      withEditTxn(db(), (txn) => element.update(txn));

      const updated = db().elements.getElement<TextAnnotation2d>(ids[name]);
      expect(updated.getAnnotation()!.toJSON(), name).to.deep.equal(TextAnnotation.fromJSON(textAnnotation).toJSON());
      expect(updated.placement.bbox.isNull, name).to.be.false;
    }

    // The leader to the left of the box extends the element's range to its target point.
    expect(db().elements.getElement<TextAnnotation2d>(ids.frameBox).placement.bbox.low.x).to.be.lessThan(-19);
  });

  it("produces annotations without a font that, like any annotation without a font, cannot be written until a font is set", () => {
    for (const name of ["missingTextStyle", "missingFont"]) {
      const { textAnnotation } = read2d(name);
      const element = db().elements.getElement<TextAnnotation2d>(ids[name]);
      element.setAnnotation(TextAnnotation.fromJSON(textAnnotation));
      expect(() => withEditTxn(db(), (txn) => element.update(txn)), name).to.throw();

      textAnnotation.textBlock!.styleOverrides!.font = { name: "Karla" };
      element.setAnnotation(TextAnnotation.fromJSON(textAnnotation));
      withEditTxn(db(), (txn) => element.update(txn));
      expect(db().elements.getElement<TextAnnotation2d>(ids[name]).placement.bbox.isNull, name).to.be.false;
    }
  });
});

function expectIModelErrorStatus(func: () => void, status: IModelStatus): void {
  try {
    func();
  } catch (err) {
    expect(err).to.be.instanceOf(IModelError);
    expect((err as IModelError).errorNumber).to.equal(status);
    return;
  }

  expect.fail("Expected an IModelError");
}