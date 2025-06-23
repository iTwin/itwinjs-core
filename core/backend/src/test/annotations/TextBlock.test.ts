/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { computeGraphemeOffsets, ComputeGraphemeOffsetsArgs, ComputeRangesForTextLayoutArgs, FindFontId, FindTextStyle, layoutTextBlock, LineLayout, RunLayout, TextBlockLayout, TextLayoutRanges } from "../../annotations/TextBlockLayout";
import { Geometry, Range2d } from "@itwin/core-geometry";
import { ColorDef, FontType, FractionRun, LineBreakRun, LineLayoutResult, Run, RunLayoutResult, TabRun, TextAnnotation, TextAnnotationAnchor, TextBlock, TextBlockGeometryPropsEntry, TextBlockMargins, TextRun, TextStringProps, TextStyleSettings } from "@itwin/core-common";
import { SnapshotDb } from "../../IModelDb";
import { IModelTestUtils } from "../IModelTestUtils";
import { ProcessDetector } from "@itwin/core-bentley";
import { produceTextBlockGeometry } from "../../core-backend";

function computeTextRangeAsStringLength(args: ComputeRangesForTextLayoutArgs): TextLayoutRanges {
  const range = new Range2d(0, 0, args.chars.length, args.lineHeight);
  return { layout: range, justification: range };
}

function doLayout(textBlock: TextBlock, args?: {
  findTextStyle?: FindTextStyle;
  findFontId?: FindFontId;
}): TextBlockLayout {
  const layout = layoutTextBlock({
    textBlock,
    iModel: {} as any,
    findTextStyle: args?.findTextStyle ?? (() => TextStyleSettings.defaults),
    findFontId: args?.findFontId ?? (() => 0),
    computeTextRange: computeTextRangeAsStringLength,
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
    const textBlock = TextBlock.create({ styleName: "block", styleOverrides: { widthFactor: 34, color: 0x00ff00 } });
    const run0 = TextRun.create({ content: "run0", styleName: "run", styleOverrides: { lineHeight: 56, color: 0xff0000 } });
    const run1 = TextRun.create({ content: "run1", styleName: "run", styleOverrides: { widthFactor: 78, fontName: "run1" } });
    textBlock.appendRun(run0);
    textBlock.appendRun(run1);

    const tb = doLayout(textBlock, {
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

  it("has consistent data when converted to a layout result", function () {
    if (!isIntlSupported()) {
      this.skip();
    }

    // Initialize a new TextBlockLayout object
    const textBlock = TextBlock.create({ width: 50, styleName: "", styleOverrides: { widthFactor: 34, color: 0x00ff00, fontName: "arial" } });
    const run0 = TextRun.create({
      content: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus pretium mi sit amet magna malesuada, at venenatis ante eleifend.",
      styleName: "",
      styleOverrides: { lineHeight: 56, color: 0xff0000 },
    });
    const run1 = TextRun.create({
      content: "Donec sit amet semper sapien. Nullam commodo, libero a accumsan lacinia, metus enim pharetra lacus, eu facilisis sem nisi eu dui.",
      styleName: "",
      styleOverrides: { widthFactor: 78, fontName: "run1" },
    });
    const run2 = TextRun.create({
      content: "Duis dui quam, suscipit quis feugiat id, fermentum ut augue. Mauris iaculis odio rhoncus lorem eleifend, posuere viverra turpis elementum.",
      styleName: "",
      styleOverrides: {},
    });
    const fractionRun = FractionRun.create({ numerator: "num", denominator: "denom", styleName: "", styleOverrides: {} });
    textBlock.appendRun(run0);
    textBlock.appendRun(fractionRun);
    textBlock.appendParagraph();
    textBlock.appendRun(run1);
    textBlock.appendRun(run2);

    // Call the toResult() method
    const textBlockLayout = doLayout(
      textBlock,
      {
        findFontId: (fontName: string) => {
          if (fontName === "arial") {
            return 1;
          } else if (fontName === "run1") {
            return 2;
          }
          return 0;
        },
      });
    const result = textBlockLayout.toResult();

    // Assert that the result object has the same data as the original TextBlockLayout object
    expect(result.range).to.deep.equal(textBlockLayout.range.toJSON());
    expect(result.lines.length).to.equal(textBlockLayout.lines.length);

    // Loop through each line in the result and the original object
    for (let i = 0; i < result.lines.length; i++) {
      const resultLine: LineLayoutResult = result.lines[i];
      const originalLine: LineLayout = textBlockLayout.lines[i];

      // Source paragraph index matches
      expect(resultLine.sourceParagraphIndex).to.equal(textBlock.paragraphs.indexOf(originalLine.source));
      // Ranges match
      expect(resultLine.range).to.deep.equal(originalLine.range.toJSON());
      expect(resultLine.justificationRange).to.deep.equal(originalLine.justificationRange.toJSON());
      // Offset matches
      expect(resultLine.offsetFromDocument).to.deep.equal(originalLine.offsetFromDocument);

      for (let j = 0; j < resultLine.runs.length; j++) {
        const resultRun: RunLayoutResult = resultLine.runs[j];
        const originalRun: RunLayout = originalLine.runs[j];

        // Source run index matches
        expect(resultRun.sourceRunIndex).to.equal(textBlock.paragraphs[resultLine.sourceParagraphIndex].runs.indexOf(originalRun.source));
        // FontId matches
        expect(resultRun.fontId).to.equal(originalRun.fontId);
        // Offsets match
        expect(resultRun.characterOffset).to.equal(originalRun.charOffset);
        expect(resultRun.characterCount).to.equal(originalRun.numChars);
        expect(resultRun.offsetFromLine).to.deep.equal(originalRun.offsetFromLine);
        // Range matches
        expect(resultRun.range).to.deep.equal(originalRun.range.toJSON());
        // Text style matches
        expect(resultRun.textStyle).to.deep.equal(originalRun.style.toJSON());
        // Optional values match existence and values
        if (resultRun.justificationRange) {
          expect(originalRun.justificationRange);
        }
        if (originalRun.justificationRange) {
          expect(resultRun.justificationRange);
        }
        if (resultRun.justificationRange && originalRun.justificationRange) {
          expect(resultRun.justificationRange).to.deep.equal(originalRun.justificationRange.toJSON());
        }
        if (resultRun.numeratorRange) {
          expect(originalRun.numeratorRange);
        }
        if (originalRun.numeratorRange) {
          expect(resultRun.numeratorRange);
        }
        if (resultRun.numeratorRange && originalRun.numeratorRange) {
          expect(resultRun.numeratorRange).to.deep.equal(originalRun.numeratorRange.toJSON());
        }
        if (resultRun.denominatorRange) {
          expect(originalRun.denominatorRange);
        }
        if (originalRun.denominatorRange) {
          expect(resultRun.denominatorRange);
        }
        if (resultRun.denominatorRange && originalRun.denominatorRange) {
          expect(resultRun.denominatorRange).to.deep.equal(originalRun.denominatorRange.toJSON());
        }
        // Check that the result string matches what we expect
        const inputRun = textBlock.paragraphs[resultLine.sourceParagraphIndex].runs[resultRun.sourceRunIndex].clone();
        if (inputRun.type === "text") {
          const resultText = inputRun.content.substring(resultRun.characterOffset, resultRun.characterOffset + resultRun.characterCount);
          const originalText = inputRun.content.substring(originalRun.charOffset, originalRun.charOffset + originalRun.numChars);
          expect(resultText).to.equal(originalText);
        }
      }
    }
  });

  it("adds margins", function () {
    const expectMargins = (layoutRange: Range2d, marginRange: Range2d, margins: Partial<TextBlockMargins>) => {
      expect(marginRange.low.x).to.equal(layoutRange.low.x - (margins.left ?? 0));
      expect(marginRange.high.x).to.equal(layoutRange.high.x + (margins.right ?? 0));
      expect(marginRange.low.y).to.equal(layoutRange.low.y - (margins.bottom ?? 0));
      expect(marginRange.high.y).to.equal(layoutRange.high.y + (margins.top ?? 0));
    }

    const makeTextBlock = (margins: Partial<TextBlockMargins>) => {
      const textBlock = TextBlock.create({ styleName: "", styleOverrides: { lineSpacingFactor: 0 }, margins });
      textBlock.appendRun(makeTextRun("abc"));
      textBlock.appendRun(makeTextRun("defg"));
      return textBlock;
    }

    let block = makeTextBlock({});
    let layout = doLayout(block);

    // Margins should be 0 by default
    expect(layout.range.isAlmostEqual(layout.textRange)).to.be.true;
    expectMargins(layout.textRange, layout.range, {});

    // All margins should be applied to the range
    block = makeTextBlock({ left: 1, right: 2, top: 3, bottom: 4 })
    layout = doLayout(block);

    expectMargins(layout.textRange, layout.range, { left: 1, right: 2, top: 3, bottom: 4 });

    // Just horizontal margins should be applied
    block = makeTextBlock({ left: 1, right: 2 });
    layout = doLayout(block);

    expectMargins(layout.textRange, layout.range, { left: 1, right: 2 });

    // Just vertical margins should be applied
    block = makeTextBlock({ top: 1, bottom: 2 });
    layout = doLayout(block);

    expectMargins(layout.textRange, layout.range, { top: 1, bottom: 2 });

  });

  describe("range", () => {

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
        const multiplier = Math.pow(100, numDecimalPlaces);
        return Math.round(num * multiplier) / multiplier;
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
          for (const run of line.runs) {
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
      textBlock.appendRun(TextRun.create({ styleName: "", content: "jkl" }));

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

    it("applies tab shifts", () => {
      const lineHeight = 1;
      const tabInterval = 6;
      const styleName = "testStyle";
      const textBlock = TextBlock.create({ styleName, styleOverrides: { lineHeight, tabInterval } });

      // Appends a line that looks like `stringOne` TAB `stringTwo` LINEBREAK
      const appendLine = (stringOne: string, stringTwo: string, wantLineBreak: boolean = true) => {
        if (stringOne.length > 0) textBlock.appendRun(TextRun.create({ styleName, content: stringOne }));
        textBlock.appendRun(TabRun.create({ styleName, styleOverrides: { tabInterval } }));
        if (stringTwo.length > 0) textBlock.appendRun(TextRun.create({ styleName, content: stringTwo }));
        if (wantLineBreak) textBlock.appendRun(LineBreakRun.create({ styleName }));
      }

      // The extra whitespace is intentional to show where the tab stops should be.
      appendLine("",      "a");
      appendLine("",      "bc");
      appendLine("a",     "a");
      appendLine("bc",    "bc");
      appendLine("cde",   "cde");
      appendLine("cdefg", "cde"); // this one is the max tab distance before needing to move to the next tab stop
      appendLine("cdefgh",      "cde"); // This one should push to the next tab stop.
      appendLine("cdefghi",     "cde", false); // This one should push to the next tab stop.

      const tb = doLayout(textBlock);
      tb.lines.forEach((line, index) => {
        const firstTextRun = (line.runs[0].source.type === "text") ? line.runs[0] : undefined;
        const firstTabRun = (line.runs[0].source.type === "tab") ? line.runs[0] : line.runs[1];

        const distance = (firstTextRun?.range.xLength() ?? 0) + firstTabRun.range.xLength();
        const expectedDistance = ((firstTextRun?.range.xLength() || 0) >= tabInterval) ? tabInterval * 2 : tabInterval;
        expect(distance).to.equal(expectedDistance, `Line ${index} does not have the expected tab distance. ${expectedDistance}`);
      });
    });

    it("applies consecutive tab shifts", () => {
      const lineHeight = 1;
      const tabInterval = 6;
      const styleName = "testStyle";
      const textBlock = TextBlock.create({ styleName, styleOverrides: { lineHeight, tabInterval } });

      // line 0: ----->----->----->LINEBREAK
      textBlock.appendRun(TabRun.create({ styleName, styleOverrides: { tabInterval } }));
      textBlock.appendRun(TabRun.create({ styleName, styleOverrides: { tabInterval } }));
      textBlock.appendRun(TabRun.create({ styleName, styleOverrides: { tabInterval } }));
      textBlock.appendRun(LineBreakRun.create({ styleName }));

      // line 1: abc-->----->LINEBREAK
      textBlock.appendRun(TextRun.create({ styleName, content: "abc" }));
      textBlock.appendRun(TabRun.create({ styleName, styleOverrides: { tabInterval } }));
      textBlock.appendRun(TabRun.create({ styleName, styleOverrides: { tabInterval } }));
      textBlock.appendRun(LineBreakRun.create({ styleName }));

      // line 2: abc--->->------>LINEBREAK
      textBlock.appendRun(TextRun.create({ styleName, content: "abc" }));
      textBlock.appendRun(TabRun.create({ styleName, styleOverrides: { tabInterval: 7 } }));
      textBlock.appendRun(TabRun.create({ styleName, styleOverrides: { tabInterval: 2 } }));
      textBlock.appendRun(TabRun.create({ styleName, styleOverrides: { tabInterval: 7 } }));
      textBlock.appendRun(LineBreakRun.create({ styleName }));

      // line 3: abc--->1/23->abcde->LINEBREAK
      textBlock.appendRun(TextRun.create({ styleName, content: "abc" }));
      textBlock.appendRun(TabRun.create({ styleName, styleOverrides: { tabInterval: 7 } }));
      textBlock.appendRun(FractionRun.create({ styleName, numerator: "1", denominator: "23" }));
      textBlock.appendRun(TabRun.create({ styleName, styleOverrides: { tabInterval: 3 } }));
      textBlock.appendRun(TextRun.create({ styleName, content: "abcde" }));
      textBlock.appendRun(TabRun.create({ styleName, styleOverrides: { tabInterval: 7 } }));
      textBlock.appendRun(LineBreakRun.create({ styleName }));

      const tb = doLayout(textBlock);

      const line0 = tb.lines[0];
      const line1 = tb.lines[1];
      const line2 = tb.lines[2];
      const line3 = tb.lines[3];

      expect(line0.runs.length).to.equal(4);
      expect(line0.range.xLength()).to.equal(3 * tabInterval, `Lines with only tabs should have the correct range length`);

      expect(line1.runs.length).to.equal(4);
      expect(line1.range.xLength()).to.equal(2 * tabInterval, `Tabs should be applied correctly when they are at the end of a line`);

      expect(line2.runs.length).to.equal(5);
      expect(line2.range.xLength()).to.equal(7 + 2 + 7, `Multiple tabs with different intervals should be applied correctly`);

      expect(line3.runs.length).to.equal(7);
      expect(line3.range.xLength()).to.equal(7 + 3 + 7, `Multiple tabs with different intervals should be applied correctly`);
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
      textBlock.appendRun(TextRun.create({ styleName: "", content: "jkl" }));

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

    function expectRange(width: number, height: number, range: Range2d): void {
      expect(range.xLength()).to.equal(width);
      expect(range.yLength()).to.equal(height);
    }

    it("computes range for wrapped lines", function () {
      if (!isIntlSupported()) {
        this.skip();
      }

      const block = TextBlock.create({ styleName: "", width: 3, styleOverrides: { lineHeight: 1, lineSpacingFactor: 0 } });

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
      expectBlockRange(8, 1);

      block.width = 6;
      expectBlockRange(6, 2);

      block.width = 10;
      expectBlockRange(10, 1);
      block.appendRun(makeTextRun("hijk"));
      expectBlockRange(10, 2);
    });

    it("computes range for split runs", function () {
      if (!isIntlSupported()) {
        this.skip();
      }

      const block = TextBlock.create({ styleName: "", styleOverrides: { lineHeight: 1, lineSpacingFactor: 0 } });

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

      // Two text runs with 7 characters total.
      block.appendRun(makeTextRun("abc"));
      block.appendRun(makeTextRun("defg"));

      // 1 line of text with width 0: left, right, center justification.
      block.justification = "left";
      expectBlockRange(7, 1);
      expectLineOffset(0, 0);

      block.justification = "right";
      expectBlockRange(7, 1);
      expectLineOffset(0, 0);

      block.justification = "center";
      expectBlockRange(7, 1);
      expectLineOffset(0, 0);

      // 1 line of text from a width greater than number of characters: left, right, center justification.
      block.width = 10;

      block.justification = "left";
      expectBlockRange(10, 1);
      expectLineOffset(0, 0);

      block.justification = "right";
      expectBlockRange(10, 1);
      expectLineOffset(3, 0); // 3 = 10 - 7

      block.justification = "center";
      expectBlockRange(10, 1);
      expectLineOffset(1.5, 0); // 1.5 = (10 - 7) / 2

      // 2 line of text from a width less than number of characters: left, right, center justification.
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

      // Testing text longer the the width of the text block.
      block.width = 2;
      block.justification = "left";
      expectBlockRange(4, 2);
      expectLineOffset(0, 0);
      expectLineOffset(0, 1);

      block.justification = "right";
      expectBlockRange(4, 2);
      expectLineOffset(-1, 0);
      expectLineOffset(-2, 1);

      block.appendRun(makeTextRun("123456789"));
      expectBlockRange(9, 3);
      expectLineOffset(-1, 0);
      expectLineOffset(-2, 1);
      expectLineOffset(-7, 2);

      block.justification = "center";
      expectBlockRange(9, 3);
      expectLineOffset(-0.5, 0);
      expectLineOffset(-1, 1);
      expectLineOffset(-3.5, 2);
    });
  });

  describe("word-wrapping", () => {

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

    it("splits a single TextRun at word boundaries if it exceeds the document width", function () {
      if (!isIntlSupported()) {
        this.skip();
      }

      expectLines("a bc def ghij klmno pqrstu vwxyz", 5, [
        "a bc ",
        "def ",
        "ghij ",
        "klmno ",
        "pqrstu ",
        "vwxyz",
      ]);

      const fox = "The quick brown fox jumped over the lazy dog";
      expectLines(fox, 50, [fox]);
      expectLines(fox, 40, [
        //       1         2         3         4
        // 34567890123456789012345678901234567890
        "The quick brown fox jumped over the ",
        "lazy dog",
      ]);
      expectLines(fox, 30, [
        //       1         2         3
        // 3456789012345678901234567890
        "The quick brown fox jumped ",
        "over the lazy dog",
      ]);
      expectLines(fox, 20, [
        //       1         2
        // 345678901234567890
        "The quick brown fox ",
        "jumped over the ",
        "lazy dog",
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

    it("considers consecutive whitespace part of a single 'word'", function () {
      if (!isIntlSupported()) {
        this.skip();
      }

      expectLines("a b  c   d    e     f      ", 3, [
        "a ",
        "b  ",
        "c   ",
        "d    ",
        "e     ",
        "f      ",
      ]);
    });

    it("wraps Japanese text", function () {
      if (!isIntlSupported()) {
        this.skip();
      }

      // "I am a cat. The name is Tanuki."
      expectLines("吾輩は猫である。名前はたぬき。", 1, ["吾", "輩", "は", "猫", "で", "あ", "る。", "名", "前", "は", "た", "ぬ", "き。"]);
    });

    it("wraps tabs", () => {
      //todo
      const lineHeight = 1;
      const styleName = "testStyle";
      const textBlock = TextBlock.create({ styleName, styleOverrides: { lineHeight } });

      // line 0:  -->-->------> LINEBREAK
      textBlock.appendRun(TabRun.create({ styleName, styleOverrides: { tabInterval: 3 } }));
      textBlock.appendRun(TabRun.create({ styleName, styleOverrides: { tabInterval: 3 } }));
      textBlock.appendRun(TabRun.create({ styleName, styleOverrides: { tabInterval: 7 } }));
      textBlock.appendRun(LineBreakRun.create({ styleName }));

      // line 1:  a->b->cd-----> LINEBREAK
      textBlock.appendRun(TextRun.create({ styleName, content: "a" }));
      textBlock.appendRun(TabRun.create({ styleName, styleOverrides: { tabInterval: 3 } }));
      textBlock.appendRun(TextRun.create({ styleName, content: "b" }));
      textBlock.appendRun(TabRun.create({ styleName, styleOverrides: { tabInterval: 3 } }));
      textBlock.appendRun(TextRun.create({ styleName, content: "cd" }));
      textBlock.appendRun(TabRun.create({ styleName, styleOverrides: { tabInterval: 7 } }));
      textBlock.appendRun(LineBreakRun.create({ styleName }));

      // line 2:  -->a->b------>cd LINEBREAK
      textBlock.appendRun(TabRun.create({ styleName, styleOverrides: { tabInterval: 3 } }));
      textBlock.appendRun(TextRun.create({ styleName, content: "a" }));
      textBlock.appendRun(TabRun.create({ styleName, styleOverrides: { tabInterval: 3 } }));
      textBlock.appendRun(TextRun.create({ styleName, content: "b" }));
      textBlock.appendRun(TabRun.create({ styleName, styleOverrides: { tabInterval: 7 } }));
      textBlock.appendRun(TextRun.create({ styleName, content: "cd" }));
      textBlock.appendRun(LineBreakRun.create({ styleName }));

      /* Full Width:
        * -->-->------>
        * a->b->cd---->
        * -->a->b----->cd
      */
      let tb = doLayout(textBlock);
      expect(tb.lines.length).to.equal(3, ``);
      expect(tb.lines[0].range.xLength()).to.equal(13, ``);
      expect(tb.lines[1].range.xLength()).to.equal(13, ``);
      expect(tb.lines[2].range.xLength()).to.equal(15, ``);

      /* Width of 10:
        * -->-->
        * ------>
        * a->b->cd
        * ------>
        * -->a->b
        * ------>cd
      */

      textBlock.width = 10;
      tb = doLayout(textBlock);
      expect(tb.lines.length).to.equal(6, ``);
      expect(tb.lines[0].range.xLength()).to.equal(6, ``);
      expect(tb.lines[1].range.xLength()).to.equal(7, ``);
      expect(tb.lines[2].range.xLength()).to.equal(8, ``);
      expect(tb.lines[3].range.xLength()).to.equal(7, ``);
      expect(tb.lines[4].range.xLength()).to.equal(7, ``);
      expect(tb.lines[5].range.xLength()).to.equal(9, ``);
    });

    it("performs word-wrapping with punctuation", function () {
      if (!isIntlSupported()) {
        this.skip();
      }

      expectLines("1.24 56.7 8,910", 1, ["1.24 ", "56.7 ", "8,910"]);

      expectLines("a.bc de.f g,hij", 1, ["a.bc ", "de.f ", "g,hij"]);

      expectLines("Let's see... can you (or anyone) predict?!", 1, [
        "Let's ",
        "see... ",
        "can ",
        "you ",
        "(or ",
        "anyone) ",
        "predict?!",
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
        // 34567890123456789012345678901234567890
        "The quick brown fox jumped over the ",
        "lazy dog",
      ]);
      test(30, [
        //        1         2         3
        // 3456789012345678901234567890
        "The quick brown fox jumped ",
        "over the lazy dog",
      ]);
      test(20, [
        //        1         2
        // 345678901234567890
        "The quick brown fox ",
        "jumped over the ",
        "lazy dog",
      ]);
      test(10, [
        //        1
        // 34567890
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
      expectLayout(19, "aabb ccc d eeff \nggg h");
      expectLayout(18, "aabb ccc d eeff \nggg h");
      expectLayout(17, "aabb ccc d eeff \nggg h");
      expectLayout(16, "aabb ccc d eeff \nggg h");
      expectLayout(15, "aabb ccc d ee\nff ggg h");
      expectLayout(14, "aabb ccc d ee\nff ggg h");
      expectLayout(13, "aabb ccc d ee\nff ggg h");
      expectLayout(12, "aabb ccc d \neeff ggg h");
      expectLayout(11, "aabb ccc d \neeff ggg h");
      expectLayout(10, "aabb ccc \nd eeff \nggg h");
      expectLayout(9, "aabb ccc \nd eeff \nggg h");
      expectLayout(8, "aabb \nccc d ee\nff ggg h");
      expectLayout(7, "aabb \nccc d \neeff \nggg h");
      expectLayout(6, "aabb \nccc d \neeff \nggg h");
      expectLayout(5, "aabb \nccc \nd ee\nff \nggg h");
      expectLayout(4, "aa\nbb \nccc \nd ee\nff \nggg \nh");
      expectLayout(3, "aa\nbb \nccc \nd \nee\nff \nggg \nh");
      expectLayout(2, "aa\nbb \nccc \nd \nee\nff \nggg \nh");
      expectLayout(1, "aa\nbb \nccc \nd \nee\nff \nggg \nh");
      expectLayout(0, "aabb ccc d eeff ggg h");
      expectLayout(-1, "aabb ccc d eeff ggg h");
      expectLayout(-2, "aabb ccc d eeff ggg h");
    });

    it("does not word wrap due to floating point rounding error", function () {
      if (!isIntlSupported()) {
        this.skip();
      }

      const block = TextBlock.create({ styleName: "", styleOverrides: { lineHeight: 1, lineSpacingFactor: 0 } });
      block.appendRun(makeTextRun("abc defg"));
      const layout1 = doLayout(block);
      let width = layout1.range.xLength();
      // Simulate a floating point rounding error by slightly reducing the width
      width -= Geometry.smallFloatingPoint;
      block.width = width;
      const layout2 = doLayout(block);
      expect(layout2.range.yLength()).to.equal(1);
    });
  });

  describe("grapheme offsets", () => {
    it("should return an empty array if source type is not text", function () {
      const textBlock = TextBlock.create({ styleName: "" });
      const fractionRun = FractionRun.create({ numerator: "1", denominator: "2", styleName: "fraction" });
      textBlock.appendRun(fractionRun);

      const layout = doLayout(textBlock);
      const result = layout.toResult();
      const args: ComputeGraphemeOffsetsArgs = {
        textBlock,
        iModel: {} as any,
        findTextStyle: () => TextStyleSettings.defaults,
        findFontId: () => 0,
        computeTextRange: computeTextRangeAsStringLength,
        paragraphIndex: result.lines[0].sourceParagraphIndex,
        runLayoutResult: result.lines[0].runs[0],
        graphemeCharIndexes: [0],
      };
      const graphemeRanges = computeGraphemeOffsets(args);

      expect(graphemeRanges).to.be.an("array").that.is.empty;
    });

    it("should handle empty text content", function () {
      const textBlock = TextBlock.create({ styleName: "" });
      const textRun = TextRun.create({ content: "", styleName: "text" });
      textBlock.appendRun(textRun);

      const layout = doLayout(textBlock);
      const result = layout.toResult();
      const args: ComputeGraphemeOffsetsArgs = {
        textBlock,
        iModel: {} as any,
        findTextStyle: () => TextStyleSettings.defaults,
        findFontId: () => 0,
        computeTextRange: computeTextRangeAsStringLength,
        paragraphIndex: result.lines[0].sourceParagraphIndex,
        runLayoutResult: result.lines[0].runs[0],
        graphemeCharIndexes: [0], // Supply a grapheme index even though there is no text
      };
      const graphemeRanges = computeGraphemeOffsets(args);

      expect(graphemeRanges).to.be.an("array").that.is.empty;
    });

    it("should compute grapheme offsets correctly for a given text", function () {
      const textBlock = TextBlock.create({ styleName: "" });
      const textRun = TextRun.create({ content: "hello", styleName: "text" });
      textBlock.appendRun(textRun);

      const layout = doLayout(textBlock);
      const result = layout.toResult();
      const args: ComputeGraphemeOffsetsArgs = {
        textBlock,
        iModel: {} as any,
        findTextStyle: () => TextStyleSettings.defaults,
        findFontId: () => 0,
        computeTextRange: computeTextRangeAsStringLength,
        paragraphIndex: result.lines[0].sourceParagraphIndex,
        runLayoutResult: result.lines[0].runs[0],
        graphemeCharIndexes: [0, 1, 2, 3, 4],
      };
      const graphemeRanges = computeGraphemeOffsets(args);

      expect(graphemeRanges).to.be.an("array").that.has.lengthOf(5);
      expect(graphemeRanges[0].high.x).to.equal(1);
      expect(graphemeRanges[4].high.x).to.equal(5);
    });

    it("should compute grapheme offsets correctly for non-English text", function () {
      const textBlock = TextBlock.create({ styleName: "" });
      // Hindi - "Paragraph"
      const textRun = TextRun.create({ content: "अनुच्छेद", styleName: "text" });
      textBlock.appendRun(textRun);

      const layout = doLayout(textBlock);
      const result = layout.toResult();
      const args: ComputeGraphemeOffsetsArgs = {
        textBlock,
        iModel: {} as any,
        findTextStyle: () => TextStyleSettings.defaults,
        findFontId: () => 0,
        computeTextRange: computeTextRangeAsStringLength,
        paragraphIndex: result.lines[0].sourceParagraphIndex,
        runLayoutResult: result.lines[0].runs[0],
        graphemeCharIndexes: [0, 1, 3, 7],
      };
      const graphemeRanges = computeGraphemeOffsets(args);

      expect(graphemeRanges).to.be.an("array").that.has.lengthOf(4); // Length based on actual grapheme segmentation
      expect(graphemeRanges[0].high.x).to.equal(1);
      expect(graphemeRanges[1].high.x).to.equal(3);
      expect(graphemeRanges[2].high.x).to.equal(7);
      expect(graphemeRanges[3].high.x).to.equal(8);
    });

    it("should compute grapheme offsets correctly for emoji content", function () {
      const textBlock = TextBlock.create({ styleName: "" });
      const textRun = TextRun.create({ content: "👨‍👦", styleName: "text" });
      textBlock.appendRun(textRun);

      const layout = doLayout(textBlock);
      const result = layout.toResult();
      const args: ComputeGraphemeOffsetsArgs = {
        textBlock,
        iModel: {} as any,
        findTextStyle: () => TextStyleSettings.defaults,
        findFontId: () => 0,
        computeTextRange: computeTextRangeAsStringLength,
        paragraphIndex: result.lines[0].sourceParagraphIndex,
        runLayoutResult: result.lines[0].runs[0],
        graphemeCharIndexes: [0],
      };
      const graphemeRanges = computeGraphemeOffsets(args);

      expect(graphemeRanges).to.be.an("array").that.has.lengthOf(1); // Length based on actual grapheme segmentation
      expect(graphemeRanges[0].high.x).to.equal(5);
    });
  });

  describe("using native font library", () => {
    let iModel: SnapshotDb;

    before(() => {
      const seedFileName = IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim");
      const testFileName = IModelTestUtils.prepareOutputFile("NativeFonts", "NativeFonts.bim");
      iModel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
    });

    after(() => iModel.close());

    it("maps font names to Id", async () => {
      const vera = iModel.fonts.findId({ name: "Vera" });
      expect(vera).to.equal(1);

      const arial = await iModel.fonts.acquireId({ name: "Arial", type: FontType.TrueType });
      const comic = await iModel.fonts.acquireId({ name: "Comic Sans", type: FontType.TrueType });
      iModel.saveChanges();

      expect(arial).to.equal(2);
      expect(comic).to.equal(3);
      expect(iModel.fonts.findId({ name: "Consolas" })).to.be.undefined;

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

      test("arial", arial);
      test("aRIaL", arial);
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
        const { justification, layout } = computeRanges(chars);
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

describe("produceTextBlockGeometry", () => {
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
    const layout = doLayout(block);
    return produceTextBlockGeometry(layout, annotation.computeTransform(layout.range)).entries;
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

  it("offsets geometry entries by margins", () => {
    function makeGeometryWithMargins(anchor: TextAnnotationAnchor, margins: TextBlockMargins): TextStringProps | undefined {
      const runs = [makeText()];
      const block = makeTextBlock(runs);
      block.margins = margins;
      const annotation = TextAnnotation.fromJSON({ textBlock: block.toJSON() });
      annotation.anchor = anchor;
      const layout = doLayout(block);
      const geom = produceTextBlockGeometry(layout, annotation.computeTransform(layout.range)).entries;

      return geom[1].text;
    }

    function testMargins(margins: TextBlockMargins, height: number, width: number) {
      // We want to disregard negative margins. Note, I'm not changing the margins object itself. It gets passed into makeGeometryWithMargins as it is.
      const left = margins.left >= 0 ? margins.left : 0;
      const right = margins.right >= 0 ? margins.right : 0;
      const top = margins.top >= 0 ? margins.top : 0;
      const bottom = margins.bottom >= 0 ? margins.bottom : 0;

      // Test case: bottom, left
      let props = makeGeometryWithMargins({ horizontal: "left", vertical: "bottom" }, margins);
      expect(props).not.to.be.undefined;
      expect(props?.origin, "Expected geometry to be offset by left and bottom margins").to.deep.equal({ x: left, y: bottom, z: 0 });

      // Test case: top, right
      props = makeGeometryWithMargins({ vertical: "top", horizontal: "right" }, margins);

      let x = (right + width) * -1;
      let y = (top + height) * -1;
      expect(props).not.to.be.undefined;
      expect(props?.origin, "Expected geometry to be offset by top and right margins").to.deep.equal({ x, y, z: 0 });

      // Test case: middle, center
      props = makeGeometryWithMargins({ vertical: "middle", horizontal: "center" }, margins);

      x = (left - right - width) / 2;
      y = (bottom - top - height) / 2;
      expect(props).not.to.be.undefined;
      expect(props?.origin, "Expected geometry to be centered in the margins").to.deep.equal({ x, y, z: 0 });
    }

    // xLength will be 4 because of the mock implementation on line 16.
    // yLength will be 1 because of the mock implementation on line 16.
    testMargins({ top: 0, right: 0, bottom: 0, left: 0 }, 1, 4);
    testMargins({ top: 1, right: 2, bottom: 3, left: 4 }, 1, 4);
    testMargins({ top: -1, right: -2, bottom: -3, left: -4 }, 1, 4);
  });
});


// Ignoring the text strings from the spell checker
// cspell:ignore jklmnop vwxyz defg hijk ghij klmno pqrstu Tanuki aabb eeff nggg amet adipiscing elit Phasellus pretium malesuada venenatis eleifend Donec sapien Nullam commodo accumsan lacinia metus enim pharetra lacus facilisis Duis suscipit quis feugiat fermentum ut augue Mauris iaculis odio rhoncus lorem viverra turpis elementum posuere Consolas अनुच्छेद cdefg cdefgh cdefghi