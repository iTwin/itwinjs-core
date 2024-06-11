/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { ComputeRangesForTextLayout, ComputeRangesForTextLayoutArgs, FindFontId, FindTextStyle, layoutTextBlock, TextBlockLayout, TextLayoutRanges } from "../../TextAnnotationLayout";
import { Range2d } from "@itwin/core-geometry";
import { ColorDef, FontMap, FractionRun, LineBreakRun, Run, TextAnnotation, TextAnnotation2dProps, TextAnnotation3dProps, TextBlock, TextBlockGeometryPropsEntry, TextRun, TextStyleSettings } from "@itwin/core-common";
import { IModelDb, SnapshotDb } from "../../IModelDb";
import { TextAnnotation2d, TextAnnotation3d } from "../../TextAnnotationElement";
import { produceTextAnnotationGeometry } from "../../TextAnnotationGeometry";
import { IModelTestUtils } from "../IModelTestUtils";
import { GeometricElement3d } from "../../Element";
import { Id64, ProcessDetector } from "@itwin/core-bentley";

function computeTextRangeAsStringLength(args: ComputeRangesForTextLayoutArgs): TextLayoutRanges {
  const range = new Range2d(0, 0, args.chars.length, args.lineHeight);
  return { layout: range, justification: range };
}

function doLayout(textBlock: TextBlock, args?: {
  findTextStyle?: FindTextStyle;
  findFontId?: FindFontId;
  computeTextRange?: ComputeRangesForTextLayout;
}): TextBlockLayout {
  const layout = layoutTextBlock({
    textBlock,
    iModel: {} as any,
    findTextStyle: args?.findTextStyle ?? (() => TextStyleSettings.defaults),
    findFontId: args?.findFontId ?? (() => 0),
    computeTextRange: args?.computeTextRange ?? computeTextRangeAsStringLength,
  });

  return layout;
}

function makeTextRun(content: string, styleName = ""): TextRun {
  return TextRun.create({ content, styleName });
}

function isIntlSupported(): boolean {
  // Node in the mobile add-on does not include Intl, so this test fails. Right now, mobile
  // users are not expected to do any editing, but long term we will attempt to find a better
  // solution.
  return !ProcessDetector.isMobileAppBackend;
}

describe("layoutTextBlock", () => {
  it("resolves TextStyleSettings from combination of TextBlock and Run", () => {
    const textBlock = TextBlock.create({ styleName: "block", styleOverrides: { widthFactor: 34, color: 0x00ff00 }});
    const run0 = TextRun.create({ content: "run0", styleName: "run", styleOverrides: { lineHeight: 56, color: 0xff0000 }});
    const run1 = TextRun.create({ content: "run1", styleName: "run", styleOverrides: { widthFactor: 78, fontName: "run1" }});
    textBlock.appendRun(run0);
    textBlock.appendRun(run1);

    const tb = doLayout(textBlock,{
      findTextStyle: (name: string) => TextStyleSettings.fromJSON(name === "block" ? { lineSpacingFactor: 12, fontName: "block" } : { lineSpacingFactor: 99, fontName: "run" }),
    });

    expect(tb.lines.length).to.equal(1);
    expect(tb.lines[0].runs.length).to.equal(2);

    const s0 = tb.lines[0].runs[0].style;
    expect(s0.lineHeight).to.equal(1);
    expect(s0.lineSpacingFactor).to.equal(12);
    expect(s0.widthFactor).to.equal(34);
    expect(s0.fontName).to.equal("run");
    expect(s0.color).to.equal(0xff0000);

    const s1 = tb.lines[0].runs[1].style;
    expect(s1.widthFactor).to.equal(34);
    expect(s1.lineSpacingFactor).to.equal(12);
    expect(s1.lineHeight).to.equal(1);
    expect(s1.fontName).to.equal("run1");
    expect(s1.color).to.equal("subcategory");
  });

  it("aligns text to center based on height of stacked fraction", () => {
    const textBlock = TextBlock.create({ styleName: "" });
    const fractionRun = FractionRun.create({ numerator: "1", denominator: "2", styleName: "fraction" });
    const textRun = TextRun.create({ content: "text", styleName: "text" });
    textBlock.appendRun(fractionRun);
    textBlock.appendRun(textRun);

    const layout = doLayout(textBlock);

    const fractionLayout = layout.lines[0].runs[0];
    const textLayout = layout.lines[0].runs[1];

    const round = (num: number, numDecimalPlaces: number) => {
      const mult = Math.pow(100, numDecimalPlaces);
      return Math.round(num * mult) / mult;
    };

    expect(textLayout.range.yLength()).to.equal(1);
    expect(round(fractionLayout.range.yLength(), 2)).to.equal(1.75);
    expect(fractionLayout.offsetFromLine.y).to.equal(0);
    expect(round(textLayout.offsetFromLine.y, 3)).to.equal(.375);
  });

  it("produces one line per paragraph if document width <= 0", () => {
    const textBlock = TextBlock.create({ styleName: "" });
    for (let i = 0; i < 4; i++) {
      const layout = doLayout(textBlock);
      if (i === 0) {
        expect(layout.range.isNull).to.be.true;
      } else {
        expect(layout.lines.length).to.equal(i);
        expect(layout.range.low.x).to.equal(0);
        expect(layout.range.low.y).to.equal(-i - (0.5 * (i - 1))); // lineSpacingFactor=0.5
        expect(layout.range.high.x).to.equal(i * 3);
        expect(layout.range.high.y).to.equal(0);
      }

      for (let l = 0; l < layout.lines.length; l++) {
        const line = layout.lines[l];
        expect(line.runs.length).to.equal(l + 1);
        expect(line.range.low.x).to.equal(0);
        expect(line.range.low.y).to.equal(0);
        expect(line.range.high.y).to.equal(1);
        expect(line.range.high.x).to.equal(3 * (l + 1));
        for (const run of line.runs){
          expect(run.charOffset).to.equal(0);
          expect(run.numChars).to.equal(3);
          expect(run.range.low.x).to.equal(0);
          expect(run.range.low.y).to.equal(0);
          expect(run.range.high.x).to.equal(3);
          expect(run.range.high.y).to.equal(1);
        }
      }

      const p = textBlock.appendParagraph();
      for (let j = 0; j <= i; j++) {
        p.runs.push(TextRun.create({ styleName: "", content: "Run" }));
      }
    }
  });

  it("produces a new line for each LineBreakRun", () => {
    const lineSpacingFactor = 0.5;
    const lineHeight = 1;
    const textBlock = TextBlock.create({ styleName: "", styleOverrides: { lineSpacingFactor, lineHeight } });
    textBlock.appendRun(TextRun.create({ styleName: "", content: "abc" }));
    textBlock.appendRun(LineBreakRun.create({ styleName: "" }));
    textBlock.appendRun(TextRun.create({ styleName: "", content: "def" }));
    textBlock.appendRun(TextRun.create({ styleName: "", content: "ghi" }));
    textBlock.appendRun(LineBreakRun.create({ styleName: "" }));
    textBlock.appendRun(TextRun.create({ styleName: "", content: "jkl"}));

    const tb = doLayout(textBlock);
    expect(tb.lines.length).to.equal(3);
    expect(tb.lines[0].runs.length).to.equal(2);
    expect(tb.lines[1].runs.length).to.equal(3);
    expect(tb.lines[2].runs.length).to.equal(1);

    expect(tb.range.low.x).to.equal(0);
    expect(tb.range.high.x).to.equal(6);
    expect(tb.range.high.y).to.equal(0);
    expect(tb.range.low.y).to.equal(-(lineSpacingFactor * 2 + lineHeight * 3));
  });

  it("computes ranges based on custom line spacing and line height", () => {
    const lineSpacingFactor = 2;
    const lineHeight = 3;
    const textBlock = TextBlock.create({ styleName: "", styleOverrides: { lineSpacingFactor, lineHeight } });
    textBlock.appendRun(TextRun.create({ styleName: "", content: "abc" }));
    textBlock.appendRun(LineBreakRun.create({ styleName: "" }));
    textBlock.appendRun(TextRun.create({ styleName: "", content: "def" }));
    textBlock.appendRun(TextRun.create({ styleName: "", content: "ghi" }));
    textBlock.appendRun(LineBreakRun.create({ styleName: "" }));
    textBlock.appendRun(TextRun.create({ styleName: "", content: "jkl"}));

    const tb = doLayout(textBlock);
    expect(tb.lines.length).to.equal(3);
    expect(tb.lines[0].runs.length).to.equal(2);
    expect(tb.lines[1].runs.length).to.equal(3);
    expect(tb.lines[2].runs.length).to.equal(1);

    // We have 3 lines each `lineHeight` high, plus 2 line breaks in between each `lineHeight*lineSpacingFactor` high.
    expect(tb.range.low.x).to.equal(0);
    expect(tb.range.high.x).to.equal(6);
    expect(tb.range.high.y).to.equal(0);
    expect(tb.range.low.y).to.equal(-(lineHeight * 3 + (lineHeight * lineSpacingFactor) * 2));

    expect(tb.lines[0].offsetFromDocument.y).to.equal(-lineHeight);
    expect(tb.lines[1].offsetFromDocument.y).to.equal(tb.lines[0].offsetFromDocument.y - (lineHeight + lineHeight * lineSpacingFactor));
    expect(tb.lines[2].offsetFromDocument.y).to.equal(tb.lines[1].offsetFromDocument.y - (lineHeight + lineHeight * lineSpacingFactor));
    expect(tb.lines.every((line) => line.offsetFromDocument.x === 0)).to.be.true;
  });

  it("splits paragraphs into multiple lines if runs exceed the document width", function () {
    if (!isIntlSupported()) {
      this.skip();
    }

    const textBlock = TextBlock.create({ styleName: "" });
    textBlock.width = 6;
    textBlock.appendRun(makeTextRun("ab"));
    expect(doLayout(textBlock).lines.length).to.equal(1);
    textBlock.appendRun(makeTextRun("cd"));
    expect(doLayout(textBlock).lines.length).to.equal(1);

    textBlock.appendRun(makeTextRun("ef"));
    expect(doLayout(textBlock).lines.length).to.equal(1);
    textBlock.appendRun(makeTextRun("ghi"));
    expect(doLayout(textBlock).lines.length).to.equal(2);

    textBlock.appendRun(makeTextRun("jklmnop"));
    expect(doLayout(textBlock).lines.length).to.equal(3);

    textBlock.appendRun(makeTextRun("q"));
    expect(doLayout(textBlock).lines.length).to.equal(4);
    textBlock.appendRun(makeTextRun("r"));
    expect(doLayout(textBlock).lines.length).to.equal(4);
    textBlock.appendRun(makeTextRun("stu"));
    expect(doLayout(textBlock).lines.length).to.equal(4);

    textBlock.appendRun(makeTextRun("vwxyz"));
    expect(doLayout(textBlock).lines.length).to.equal(5);
  });

  function expectRange(width: number, height: number, range: Range2d): void {
    expect(range.xLength()).to.equal(width);
    expect(range.yLength()).to.equal(height);
  }

  it("computes range for wrapped lines", function () {
    if (!isIntlSupported()) {
      this.skip();
    }

    const block = TextBlock.create({ styleName: "", width: 3, styleOverrides: { lineHeight: 1, lineSpacingFactor: 0 } })

    function expectBlockRange(width: number, height: number): void {
      const layout = doLayout(block);
      expectRange(width, height, layout.range);
    }

    block.appendRun(makeTextRun("abc"));
    expectBlockRange(3, 1);

    block.appendRun(makeTextRun("defg"));
    expectBlockRange(4, 2);

    block.width = 1;
    expectBlockRange(4, 2);

    block.width = 8;
    expectBlockRange(7, 1);
  
    block.width = 6;
    expectBlockRange(4, 2);

    block.width = 10;
    expectBlockRange(7, 1);
    block.appendRun(makeTextRun("hijk"));
    expectBlockRange(7, 2);
  });

  it("computes range for split runs", function () {
    if (!isIntlSupported()) {
      this.skip();
    }

    const block = TextBlock.create({ styleName: "", styleOverrides: { lineHeight: 1, lineSpacingFactor: 0 } })

    function expectBlockRange(width: number, height: number): void {
      const layout = doLayout(block);
      expectRange(width, height, layout.range);
    }

    const sentence = "a bc def ghij klmno";
    expect(sentence.length).to.equal(19);
    block.appendRun(makeTextRun(sentence));

    block.width = 19;
    expectBlockRange(19, 1);

    block.width = 10;
    expectBlockRange(10, 2);
  });
    
  it("justifies lines", function () {
    if (!isIntlSupported()) {
      this.skip();
    }
    
    const block = TextBlock.create({ styleName: "", styleOverrides: { lineSpacingFactor: 0 } });
    
    function expectBlockRange(width: number, height: number): void {
      const layout = doLayout(block);
      expectRange(width, height, layout.range);
    }

    function expectLineOffset(offset: number, lineIndex: number): void {
      const layout = doLayout(block);
      expect(layout.lines.length).least(lineIndex + 1);

      const line = layout.lines[lineIndex];
      expect(line.offsetFromDocument.y).to.equal(-(lineIndex + 1));
      expect(line.offsetFromDocument.x).to.equal(offset);
    }

    block.appendRun(makeTextRun("abc"));
    block.appendRun(makeTextRun("defg"));
    expectBlockRange(7, 1);
    expectLineOffset(0, 0);

    block.justification = "right";
    expectBlockRange(7, 1);
    expectLineOffset(0, 0);

    block.justification = "center";
    expectBlockRange(7, 1);
    expectLineOffset(0, 0);

    block.justification = "left";
    block.width = 4;
    expectBlockRange(4, 2);
    expectLineOffset(0, 0);
    expectLineOffset(0, 1);

    block.justification = "right";
    expectBlockRange(4, 2);
    expectLineOffset(1, 0);
    expectLineOffset(0, 1);

    block.justification = "center";
    expectBlockRange(4, 2);
    expectLineOffset(0.5, 0);
    expectLineOffset(0, 1);

    block.width = 2;
    block.justification = "left";
    expectBlockRange(4, 2);
    expectLineOffset(0, 0);
    expectLineOffset(0, 1);

    block.justification = "right";
    expectBlockRange(4, 2);
    expectLineOffset(1, 0);
    expectLineOffset(0, 1);

    block.appendRun(makeTextRun("123456789"));
    expectBlockRange(9, 3);
    expectLineOffset(6, 0);
    expectLineOffset(5, 1);
    expectLineOffset(0, 2);

    block.justification = "center";
    expectBlockRange(9, 3);
    expectLineOffset(3, 0);
    expectLineOffset(2.5, 1);
    expectLineOffset(0, 2);
  });

  function expectLines(input: string, width: number, expectedLines: string[]): TextBlockLayout {
    const textBlock = TextBlock.create({ styleName: "" });
    textBlock.width = width;
    const run = makeTextRun(input);
    textBlock.appendRun(run);

    const layout = doLayout(textBlock);
    expect(layout.lines.every((line) => line.runs.every((r) => r.source === run))).to.be.true;

    const actual = layout.lines.map((line) => line.runs.map((runLayout) => (runLayout.source as TextRun).content.substring(runLayout.charOffset, runLayout.charOffset + runLayout.numChars)).join(""));
    expect(actual).to.deep.equal(expectedLines);

    return layout;
  }

  it("splits a single TextRun at word boundaries if it exceeds the document width", function () {
    if (!isIntlSupported()) {
      this.skip();
    }

    expectLines("a bc def ghij klmno pqrstu vwxyz", 5, [
      "a bc ",
      "def ",
      "ghij ",
      "klmno",
      " ",
      "pqrstu",
      " ",
      "vwxyz",
    ]);

    const fox = "The quick brown fox jumped over the lazy dog";
    expectLines(fox, 50, [fox]);
    expectLines(fox, 40, [
      //        1         2         3         4
      // 234567890123456789012345678901234567890
      "The quick brown fox jumped over the lazy",
      " dog",
    ]);
    expectLines(fox, 30, [
      //        1         2         3
      // 23456789012345678901234567890
      "The quick brown fox jumped ",
      "over the lazy dog",
    ]);
    expectLines(fox, 20, [
      //        1         2
      // 2345678901234567890
      "The quick brown fox ",
      "jumped over the lazy",
      " dog",
    ]);
    expectLines(fox, 10, [
      //        1
      // 234567890
      "The quick ",
      "brown fox ",
      "jumped ",
      "over the ",
      "lazy dog",
    ]);
  });

  it("considers consecutive whitespace a single 'word'", function () {
    if (!isIntlSupported()) {
      this.skip();
    }

    expectLines("a b  c   d    e     f      ", 3, [
      "a b",
      "  c",
      "   ",
      "d",
      "    ",
      "e",
      "     ",
      "f",
      "      ",
    ]);
  });

  it("performs word-wrapping on Japanese text", function () {
    if (!isIntlSupported()) {
      this.skip();
    }

    // "I am a cat. The name is Tanuki."
    expectLines("吾輩は猫である。名前はたぬき。", 1, ["吾輩", "は", "猫", "で", "ある", "。", "名前", "は", "たぬき", "。"]);
  });

  it("performs word-wrapping with punctuation", function () {
    if (!isIntlSupported()) {
      this.skip();
    }

    expectLines("1.24 56.7 8,910", 1, ["1.24", " ", "56.7", " ", "8,910"]);

    // NOTE: Chrome splits a.bc and de.f on the periods. Safari and electron do not.
    // Since text layout is done in the backend, we're going to assume electron is right, and if not, that it's their responsibility to fix it.
    expectLines("a.bc de.f g,hij", 1, ["a.bc", " ", "de.f", " ", "g", ",", "hij"]);

    expectLines("Let's see...can you (or anyone) predict?!", 1, [
      "Let's", " ",
      "see",
      ".", ".", ".",
      "can", " ",
      "you", " ",
      "(", "or", " ", "anyone", ")", " ",
      "predict", "?", "!",
    ]);
  });

  it("performs word-wrapping and line-splitting with multiple runs", function () {
    if (!isIntlSupported()) {
      this.skip();
    }

    const textBlock = TextBlock.create({ styleName: "" });
    for (const str of ["The ", "quick brown", " fox jumped over ", "the lazy ", "dog"]) {
      textBlock.appendRun(makeTextRun(str));
    }

    function test(width: number, expected: string[]): void {
      textBlock.width = width;
      const layout = doLayout(textBlock);
      const actual = layout.lines.map((line) => line.runs.map((runLayout) => (runLayout.source as TextRun).content.substring(runLayout.charOffset, runLayout.charOffset + runLayout.numChars)).join(""));
      expect(actual).to.deep.equal(expected);
    }

    test(50, ["The quick brown fox jumped over the lazy dog"]);
    test(40, [
      //        1         2         3         4
      // 234567890123456789012345678901234567890
      "The quick brown fox jumped over the lazy",
      " dog",
    ]);
    test(30, [
      //        1         2         3
      // 23456789012345678901234567890
      "The quick brown fox jumped ",
      "over the lazy dog",
    ]);
    test(20, [
      //        1         2
      // 2345678901234567890
      "The quick brown fox ",
      "jumped over the lazy",
      " dog",
    ]);
    test(10, [
      //        1
      // 234567890
      "The quick ",
      "brown fox ",
      "jumped ",
      "over the ",
      "lazy dog",
    ]);
  });

  it("wraps multiple runs", function () {
    if (!isIntlSupported()) {
      this.skip();
    }

    const block = TextBlock.create({ styleName: "" });
    block.appendRun(makeTextRun("aa")); // 2 chars wide
    block.appendRun(makeTextRun("bb ccc d ee")); // 11 chars wide
    block.appendRun(makeTextRun("ff ggg h")); // 8 chars wide

    function expectLayout(width: number, expected: string): void {
      block.width = width;
      const layout = doLayout(block);
      expect(layout.stringify()).to.equal(expected);
    }

    expectLayout(23, "aabb ccc d eeff ggg h");
    expectLayout(22, "aabb ccc d eeff ggg h");
    expectLayout(21, "aabb ccc d eeff ggg h");
    expectLayout(20, "aabb ccc d eeff ggg \nh");
    expectLayout(19, "aabb ccc d eeff ggg\n h");
    expectLayout(18, "aabb ccc d eeff \nggg h");
    expectLayout(17, "aabb ccc d eeff \nggg h");
    expectLayout(16, "aabb ccc d eeff \nggg h");
    expectLayout(15, "aabb ccc d eeff\n ggg h");
    expectLayout(14, "aabb ccc d ee\nff ggg h");
    expectLayout(13, "aabb ccc d ee\nff ggg h");
    expectLayout(12, "aabb ccc d \neeff ggg h");
    expectLayout(11, "aabb ccc d \neeff ggg h");
    expectLayout(10, "aabb ccc d\n eeff ggg \nh");
    expectLayout(9, "aabb ccc \nd eeff \nggg h");
    expectLayout(8, "aabb ccc\n d eeff \nggg h");
    expectLayout(7, "aabb \nccc d \neeff \nggg h");
    expectLayout(6, "aabb \nccc d \neeff \nggg h");
    expectLayout(5, "aabb \nccc d\n eeff\n ggg \nh");
    expectLayout(4, "aabb\n ccc\n d \neeff\n ggg\n h");
    expectLayout(3, "aa\nbb \nccc\n d \nee\nff \nggg\n h");
    expectLayout(2, "aa\nbb\n \nccc\n d\n \nee\nff\n \nggg\n h");
    expectLayout(1, "aa\nbb\n \nccc\n \nd\n \nee\nff\n \nggg\n \nh");
    expectLayout(0, "aabb ccc d eeff ggg h");
    expectLayout(-1, "aabb ccc d eeff ggg h");
    expectLayout(-2, "aabb ccc d eeff ggg h");
  });

  describe("using native font library", () => {
    let iModel: SnapshotDb;

    before(() => {
      const seedFileName = IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim");
      const testFileName = IModelTestUtils.prepareOutputFile("NativeFonts", "NativeFonts.bim");
      iModel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
    });

    after(() => iModel.close());

    it("maps font names to Id", () => {
      const vera = iModel.fontMap.getFont("Vera")!.id;
      expect(vera).to.equal(1);

      iModel.addNewFont("Arial");
      iModel.addNewFont("Comic Sans");
      iModel.saveChanges();

      const arial = iModel.fontMap.getFont("Arial")!.id;
      const comic = iModel.fontMap.getFont("Comic Sans")!.id;
      expect(arial).to.equal(2);
      expect(comic).to.equal(3);
      expect(iModel.fontMap.getFont("Consolas")).to.be.undefined;

      function test(fontName: string, expectedFontId: number): void {
        const textBlock = TextBlock.create({ styleName: "" });
        textBlock.appendRun(TextRun.create({ styleName: "", styleOverrides: { fontName } }));
        const layout = layoutTextBlock({ textBlock, iModel });
        const run = layout.lines[0].runs[0];
        expect(run).not.to.be.undefined;
        expect(run.fontId).to.equal(expectedFontId);
      }

      test("Arial", arial);
      test("Comic Sans", comic);
      test("Consolas", 0);

      // ###TODO: native code uses SQLite's NOCASE collation; TypeScript FontMap does not.
      // ###TODO: we need to fix the collation to use Unicode; SQLite only applies to ASCII characters.
      // test("arial", arial);
      // test("aRIaL", arial);
    });

    function computeDimensions(args: { content?: string, bold?: boolean, italic?: boolean, font?: string, height?: number, width?: number }): { x: number, y: number } {
      const textBlock = TextBlock.create({
        styleName: "",
        styleOverrides: {
          lineHeight: args.height,
          widthFactor: args.width,
        },
      });

      textBlock.appendRun(TextRun.create({
        styleName: "",
        content: args.content ?? "This is a string of text.",
        styleOverrides: {
          isBold: args.bold,
          isItalic: args.italic,
          fontName: args.font ?? "Vera",
        },
      }));

      const range = layoutTextBlock({ textBlock, iModel }).range;
      return { x: range.high.x - range.low.x, y: range.high.y - range.low.y };
    }

    it("computes different ranges for different strings", () => {
      expect(computeDimensions({ content: "text" })).to.deep.equal(computeDimensions({ content: "text" }));
      expect(computeDimensions({ content: "text" })).not.to.deep.equal(computeDimensions({ content: "texttexttext" }));
      expect(computeDimensions({ content: "text" })).not.to.deep.equal(computeDimensions({ content: "TEXT" }));
    });

    it("computes different ranges for different fonts", () => {
      // These two are embedded in the iModel.
      expect(computeDimensions({ font: "Vera" })).not.to.deep.equal(computeDimensions({ font: "Karla" }));

      // These two are not embedded in the iModel, but do exist in its font table - they should both fall back to the default font.
      expect(computeDimensions({ font: "Arial" })).to.deep.equal(computeDimensions({ font: "Comic Sans" }));
    });

    it("computes different ranges for different height and width", () => {
      expect(computeDimensions({ height: 2 })).to.deep.equal(computeDimensions({ height: 2 }));
      expect(computeDimensions({ height: 2 })).not.to.deep.equal(computeDimensions({ height: 3 }));
      expect(computeDimensions({ width: 2 })).to.deep.equal(computeDimensions({ width: 2 }));
      expect(computeDimensions({ width: 2 })).not.to.deep.equal(computeDimensions({ width: 3 }));
    });

    it("excludes trailing blank glyphs from justification ranges", () => {
      function computeRanges(chars: string): TextLayoutRanges {
        return iModel.computeRangesForText({
          chars,
          bold: false,
          italic: false,
          fontId: 1,
          widthFactor: 1,
          lineHeight: 1,
          baselineShift: "none",
        });
      }

      function test(chars: string, expectEqualRanges: boolean): void {
        const { justification, layout }= computeRanges(chars);
        expect(layout.low.x).to.equal(justification.low.x);
        expect(layout.high.y).to.equal(justification.high.y);
        expect(layout.low.y).to.equal(justification.low.y);

        if (expectEqualRanges) {
          expect(layout.high.x).to.equal(justification.high.x);
        } else {
          expect(layout.high.x).greaterThan(justification.high.x);
        }
      }

      test("abcdef", true);
      test("abcdef ", false);
      test("abcdef   ", false);
      test("abc def", true);

      // new line has no width ever.
      test("abcdef\n", true);

      // apparently native code doesn't consider tab characters to be "blank".
      test("abcdef\t", true);

      // apparently native code doesn't consider "thin space" to be "blank".
      test("abcdef\u2009", true);

      const r1 = computeRanges("abcdef ");
      const r2 = computeRanges("abcdef    ");
      expect(r1.layout.xLength()).lessThan(r2.layout.xLength());
      expect(r1.justification.xLength()).to.equal(r2.justification.xLength());
    });
  });
});

function mockIModel(): IModelDb {
  const iModel: Pick<IModelDb, "fontMap" | "computeRangesForText" | "forEachMetaData"> = {
    fontMap: new FontMap(),
    computeRangesForText: () => { return { layout: new Range2d(0, 0, 1, 1), justification: new Range2d(0, 0, 1, 1) }; },
    forEachMetaData: () => undefined,
  };

  return iModel as IModelDb;
}

describe("produceTextAnnotationGeometry", () => {
  type Color = ColorDef | "subcategory";

  function makeText(color?: Color): TextRun {
    const styleOverrides = undefined !== color ? { color: color instanceof ColorDef ? color.toJSON() : color } : undefined;
    return TextRun.create({ styleName: "", styleOverrides, content: "text" });
  }

  function makeFraction(color?: Color): FractionRun {
    const styleOverrides = undefined !== color ? { color: color instanceof ColorDef ? color.toJSON() : color } : undefined;
    return FractionRun.create({ numerator: "num", denominator: "denom", styleName: "", styleOverrides });
  }

  function makeBreak(color?: Color): LineBreakRun {
    const styleOverrides = undefined !== color ? { color: color instanceof ColorDef ? color.toJSON() : color } : undefined;
    return LineBreakRun.create({ styleName: "", styleOverrides });
  }

  function makeTextBlock(runs: Run[]): TextBlock {
    const block = TextBlock.create({ styleName: "" });
    for (const run of runs) {
      block.appendRun(run);
    }

    return block;
  }

  function makeGeometry(runs: Run[]): TextBlockGeometryPropsEntry[] {
    const block = makeTextBlock(runs);
    const annotation = TextAnnotation.fromJSON({ textBlock: block.toJSON() });
    return produceTextAnnotationGeometry({ iModel: mockIModel(), annotation }).entries;
  }

  it("produces an empty array for an empty text block", () => {
    expect(makeGeometry([])).to.deep.equal([]);
  });

  it("produces an empty array for a block consisting only of line breaks", () => {
    expect(makeGeometry([makeBreak(), makeBreak(), makeBreak()])).to.deep.equal([]);
  });

  it("produces one appearance entry if all runs use subcategory color", () => {
    const geom = makeGeometry([makeText(), makeFraction(), makeText("subcategory"), makeFraction("subcategory")]);
    expect(geom.length).to.equal(9);
    expect(geom[0].color).to.equal("subcategory");
    expect(geom.slice(1).some((entry) => entry.color !== undefined)).to.be.false;
  });

  it("produces strings and fraction separators", () => {
    const geom = makeGeometry([makeText(), makeFraction(), makeFraction(), makeText()]);
    expect(geom.length).to.equal(9);
    expect(geom[0].color).to.equal("subcategory");

    expect(geom[1].text).not.to.be.undefined;

    expect(geom[2].text).not.to.be.undefined;
    expect(geom[3].separator).not.to.be.undefined;
    expect(geom[4].text).not.to.be.undefined;

    expect(geom[5].text).not.to.be.undefined;
    expect(geom[6].separator).not.to.be.undefined;
    expect(geom[7].text).not.to.be.undefined;

    expect(geom[8].text).not.to.be.undefined;
  });

  it("produces an appearance change for each non-break run that is a different color from the previous run", () => {
    const geom = makeGeometry([
      makeText(ColorDef.blue),
      makeText(), // subcategory by default
      makeText(),
      makeText(ColorDef.red),
      makeText(ColorDef.white),
      makeText(ColorDef.white),
      makeBreak("subcategory"),
      makeFraction(ColorDef.green),
      makeText(ColorDef.green),
      makeBreak(ColorDef.black),
      makeText(ColorDef.green),
    ]).map((entry) => entry.text ? "text" : (entry.separator ? "sep" : (typeof entry.color === "number" ? ColorDef.fromJSON(entry.color) : entry.color)));

    expect(geom).to.deep.equal([
      ColorDef.blue,
      "text",
      "subcategory",
      "text",
      "text",
      ColorDef.red,
      "text",
      ColorDef.white,
      "text",
      "text",
      ColorDef.green,
      "text", "sep", "text",
      "text",
      "text",
    ]);
  });
});

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

      const annotation = { textBlock: TextBlock.create({ styleName: "block" }).toJSON() };
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
      elem.setAnnotation(TextAnnotation.fromJSON({ textBlock: { styleName: "block" } }), "0x1234");
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
