/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { computeGraphemeOffsets, ComputeGraphemeOffsetsArgs, layoutTextBlock, LineLayout, RunLayout, TextBlockLayout, TextLayoutRanges, TextStyleResolver } from "../../annotations/TextBlockLayout";
import { Geometry, Range2d } from "@itwin/core-geometry";
import { ColorDef, FontType, FractionRun, LineBreakRun, LineLayoutResult, List, ListMarkerEnumerator, Paragraph, ParagraphProps, Run, RunLayoutResult, TabRun, TextAnnotation, TextAnnotationAnchor, TextBlock, TextBlockGeometryPropsEntry, TextBlockLayoutResult, TextBlockMargins, TextJustification, TextRun, TextStringProps, TextStyleSettings } from "@itwin/core-common";
import { SnapshotDb } from "../../IModelDb";
import { IModelTestUtils } from "../IModelTestUtils";
import { Id64String, ProcessDetector } from "@itwin/core-bentley";
import { produceTextBlockGeometry } from "../../core-backend";
import { computeTextRangeAsStringLength, doLayout } from "../AnnotationTestUtils";

function makeTextRun(content: string): TextRun {
  return TextRun.create({ content });
}

function isIntlSupported(): boolean {
  // Node in the mobile add-on does not include Intl, so this test fails. Right now, mobile
  // users are not expected to do any editing, but long term we will attempt to find a better
  // solution.
  return !ProcessDetector.isMobileAppBackend;
}

function findTextStyleImpl(id: Id64String): TextStyleSettings {
  if (id === "0x42") {
    return TextStyleSettings.fromJSON({ lineSpacingFactor: 12, font: { name: "block" }, isBold: true });
  }

  return TextStyleSettings.fromJSON({ lineSpacingFactor: 1, font: { name: "other" } });
}

describe("layoutTextBlock", () => {
  describe("resolves TextStyleSettings", () => {
    it("inherits styling from TextBlock when Paragraph and Run have no style overrides", () => {
      const textBlock = TextBlock.create();
      const run = TextRun.create({ content: "test" });
      textBlock.appendParagraph();
      textBlock.appendRun(run);

      const tb = doLayout(textBlock, {
        textStyleId: "0x42",
        findTextStyle: findTextStyleImpl,
      });

      expect(tb.lines.length).to.equal(1);
      expect(tb.lines[0].runs.length).to.equal(1);

      const runStyle = tb.lines[0].runs[0].style;
      expect(runStyle.font.name).to.equal("block");
      expect(runStyle.lineSpacingFactor).to.equal(12);
      expect(runStyle.isBold).to.be.true;
    });

    it("inherits style overrides from Paragraph when Run has no style overrides", () => {
      const textBlock = TextBlock.create();
      textBlock.appendParagraph({ styleOverrides: { font: { name: "paragraph" } } });
      textBlock.appendRun(TextRun.create({ content: "test" }));

      const tb = doLayout(textBlock, {
        textStyleId: "0x42",
        findTextStyle: findTextStyleImpl,
      });

      expect(tb.lines.length).to.equal(1);
      expect(tb.lines[0].runs.length).to.equal(1);

      const runStyle = tb.lines[0].runs[0].style;
      expect(runStyle.font.name).to.equal("paragraph");
      expect(runStyle.isBold).to.be.true;
    });

    it("uses Run style overrides when Run has overrides", () => {
      const textBlock = TextBlock.create();
      textBlock.appendParagraph({ styleOverrides: { lineSpacingFactor: 55, font: { name: "paragraph" } } });
      textBlock.appendRun(TextRun.create({ content: "test", styleOverrides: { lineSpacingFactor: 99, font: { name: "run" } } }));

      const tb = doLayout(textBlock, {
        textStyleId: "0x42",
        findTextStyle: findTextStyleImpl,
      });

      expect(tb.lines.length).to.equal(1);
      expect(tb.lines[0].runs.length).to.equal(1);

      const runStyle = tb.lines[0].runs[0].style;
      expect(runStyle.font.name).to.equal("run");
      expect(runStyle.isBold).to.be.true;
    });

    it("still uses TextBlock specific styles when Run has style overrides", () => {
      // Some style settings make sense on a TextBlock, so they are always applied from the TextBlock, even if the Run has a style override.
      const textBlock = TextBlock.create();
      const run = TextRun.create({ content: "test", styleOverrides: { lineSpacingFactor: 99, font: { name: "run" } } });
      textBlock.appendParagraph();
      textBlock.appendRun(run);

      const tb = doLayout(textBlock, {
        textStyleId: "0x42",
        findTextStyle: findTextStyleImpl,
      });

      expect(tb.lines.length).to.equal(1);
      expect(tb.lines[0].runs.length).to.equal(1);

      const runStyle = tb.lines[0].runs[0].style;
      expect(runStyle.lineSpacingFactor).to.equal(12);
    });

    it("inherits overrides from TextBlock, Paragraph and Run when there is no styleId", () => {
      const textBlock = TextBlock.create({ styleOverrides: { widthFactor: 34, textHeight: 3, lineSpacingFactor: 12, paragraphSpacingFactor: 2, isBold: true } });
      const run = TextRun.create({ content: "test", styleOverrides: { widthFactor: 78, font: { name: "override" }, leader: { wantElbow: true } } });
      textBlock.appendParagraph({ styleOverrides: { textHeight: 56, paragraphSpacingFactor: 25, color: 0xff0000, frame: { shape: "octagon" } } });
      textBlock.appendRun(run);

      const tb = doLayout(textBlock, {
        findTextStyle: findTextStyleImpl,
      });

      expect(tb.lines.length).to.equal(1);
      expect(tb.lines[0].runs.length).to.equal(1);

      const runStyle = tb.lines[0].runs[0].style;
      // widthFactor is always taken from the TextBlock, even if the Run has overrides
      expect(runStyle.widthFactor).to.equal(34);
      // paragraphSpacingFactor is always taken from the TextBlock, even if the Run has overrides
      expect(runStyle.paragraphSpacingFactor).to.equal(2);
      // lineSpacingFactor is always taken from the TextBlock, even if the Run has overrides
      expect(runStyle.lineSpacingFactor).to.equal(12);
      // frame settings are always taken from the TextBlock, even if the Paragraph or Run has overrides
      expect(runStyle.frame.shape).to.equal("none");
      // leader settings are always taken from the TextBlock, even if the Paragraph or Run has overrides
      expect(runStyle.leader.wantElbow).to.be.false;
      expect(runStyle.font.name).to.equal("override");
      expect(runStyle.color).to.equal(0xff0000);
      expect(runStyle.isBold).to.be.true;
      expect(runStyle.textHeight).to.equal(56);
    });

    it("does not inherit overrides in TextBlock or Paragraph when Run has same propertied overriden - unless they are TextBlock specific settings", () => {
      const textBlock = TextBlock.create({ styleOverrides: { widthFactor: 34, margins: { left: 3 }, textHeight: 3, lineSpacingFactor: 12, paragraphSpacingFactor: 2, isBold: true, justification: "center" } });
      const run = TextRun.create({ content: "test", styleOverrides: { widthFactor: 78, margins: { left: 4, right: 3 }, textHeight: 6, paragraphSpacingFactor: 25, lineSpacingFactor: 24, font: { name: "override" }, isBold: false, justification: "right" } });
      textBlock.appendParagraph({ styleOverrides: { textHeight: 56, paragraphSpacingFactor: 50, color: 0xff0000, justification: "left" } });
      textBlock.appendRun(run);

      const tb = doLayout(textBlock, {
        textStyleId: "0x42",
        findTextStyle: findTextStyleImpl,
      });

      expect(tb.lines.length).to.equal(1);
      expect(tb.lines[0].runs.length).to.equal(1);

      const runStyle = tb.lines[0].runs[0].style;
      // widthFactor is always taken from the TextBlock, even if the Run has a styleId or overrides
      expect(runStyle.widthFactor).to.equal(34);
      // paragraphSpacingFactor is always taken from the TextBlock, even if the Run has overrides
      expect(runStyle.paragraphSpacingFactor).to.equal(2);
      // lineSpacingFactor is always taken from the TextBlock, even if the Run has a styleId or overrides
      expect(runStyle.lineSpacingFactor).to.equal(12);
      // margins are always taken from the TextBlock, even if the Paragraph or Run has overrides
      expect(runStyle.margins.left).to.equal(3);
      expect(runStyle.margins.right).to.equal(0);
      // justification is always taken from the TextBlock, even if the Paragraph or Run has overrides
      expect(runStyle.justification).to.equal("center");
      expect(runStyle.font.name).to.equal("override");
      expect(runStyle.color).to.equal(0xff0000);
      expect(runStyle.isBold).to.be.false;
      expect(runStyle.textHeight).to.equal(6);
    });

    it("takes child overrides over parent overrides", () => {
      //...unless they are TextBlock specific as covered in other tests
      const textBlock = TextBlock.create({ styleOverrides: { font: { name: "grandparent" } } });
      const run = TextRun.create({ content: "test", styleOverrides: { font: { name: "child" } } });
      textBlock.appendParagraph({ styleOverrides: { font: { name: "parent" } } });
      textBlock.appendRun(run);

      const tb = doLayout(textBlock, {
        findTextStyle: findTextStyleImpl,
      });

      expect(tb.lines.length).to.equal(1);
      expect(tb.lines[0].runs.length).to.equal(1);

      const runStyle = tb.lines[0].runs[0].style;
      expect(runStyle.font.name).to.equal("child");
    });
  });

  it("has consistent data when converted to a layout result", function () {
    if (!isIntlSupported()) {
      this.skip();
    }

    // Initialize a new TextBlockLayout object
    const textBlock = TextBlock.create({ width: 50, styleOverrides: { widthFactor: 34, color: 0x00ff00, font: { name: "arial" } } });
    const run0 = TextRun.create({
      content: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus pretium mi sit amet magna malesuada, at venenatis ante eleifend.",
      styleOverrides: { textHeight: 56, color: 0xff0000 },
    });
    const run1 = TextRun.create({
      content: "Donec sit amet semper sapien. Nullam commodo, libero a accumsan lacinia, metus enim pharetra lacus, eu facilisis sem nisi eu dui.",
      styleOverrides: { widthFactor: 78, font: { name: "run1" } },
    });
    const run2 = TextRun.create({
      content: "Duis dui quam, suscipit quis feugiat id, fermentum ut augue. Mauris iaculis odio rhoncus lorem eleifend, posuere viverra turpis elementum.",
      styleOverrides: {},
    });
    const fractionRun = FractionRun.create({ numerator: "num", denominator: "denom", styleOverrides: {} });
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

      // Ranges match
      expect(resultLine.range).to.deep.equal(originalLine.range.toJSON());
      expect(resultLine.justificationRange).to.deep.equal(originalLine.justificationRange.toJSON());
      // Offset matches
      expect(resultLine.offsetFromDocument).to.deep.equal(originalLine.offsetFromDocument);

      for (let j = 0; j < resultLine.runs.length; j++) {
        const resultRun: RunLayoutResult = resultLine.runs[j];
        const originalRun: RunLayout = originalLine.runs[j];

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
        const inputRun = originalRun.source;
        if (inputRun.type === "text") {
          const resultText = inputRun.content.substring(resultRun.characterOffset, resultRun.characterOffset + resultRun.characterCount);
          const originalText = inputRun.content.substring(originalRun.charOffset, originalRun.charOffset + originalRun.numChars);
          expect(resultText).to.equal(originalText);
        }
      }
    }
  });

  it("adds margins", function () {
    const expectMargins = (layoutRange: Range2d, marginRange: Range2d, margins: TextBlockMargins) => {
      const textHeight = TextStyleSettings.defaultProps.textHeight;
      expect(marginRange.low.x).to.equal(layoutRange.low.x - ((margins.left ?? 0) * textHeight));
      expect(marginRange.high.x).to.equal(layoutRange.high.x + ((margins.right ?? 0) * textHeight));
      expect(marginRange.low.y).to.equal(layoutRange.low.y - ((margins.bottom ?? 0) * textHeight));
      expect(marginRange.high.y).to.equal(layoutRange.high.y + ((margins.top ?? 0) * textHeight));
    }

    const textBlock = TextBlock.create({ styleOverrides: { lineSpacingFactor: 0 } });
    textBlock.appendRun(makeTextRun("abc"));
    textBlock.appendRun(makeTextRun("defg"));

    const marginStyleCallback = (margins: TextBlockMargins) => {
      return () => TextStyleSettings.fromJSON({ margins: { ...margins } })
    }

    let layout = doLayout(textBlock, {
      findTextStyle: marginStyleCallback({}),
    });

    // Margins should be 0 by default
    expect(layout.range.isAlmostEqual(layout.textRange)).to.be.true;
    expectMargins(layout.textRange, layout.range, {});

    // All margins should be applied to the range
    layout = doLayout(textBlock, {
      findTextStyle: marginStyleCallback({ left: 1, right: 2, top: 3, bottom: 4 }),
    });

    expectMargins(layout.textRange, layout.range, { left: 1, right: 2, top: 3, bottom: 4 });

    // Just horizontal margins should be applied
    layout = doLayout(textBlock, {
      findTextStyle: marginStyleCallback({ left: 1, right: 2 }),
    });

    expectMargins(layout.textRange, layout.range, { left: 1, right: 2 });

    // Just vertical margins should be applied
    layout = doLayout(textBlock, {
      findTextStyle: marginStyleCallback({ top: 1, bottom: 2 }),
    });

    expectMargins(layout.textRange, layout.range, { top: 1, bottom: 2 });
  });

  describe("range", () => {
    const round = (num: number, numDecimalPlaces: number) => {
      const multiplier = Math.pow(100, numDecimalPlaces);
      return Math.round(num * multiplier) / multiplier;
    };

    it("aligns text of the same size on the bottom of the line", () => {
      const textHeight = TextStyleSettings.defaultProps.textHeight;
      const textBlock = TextBlock.create();
      const run1 = TextRun.create({ content: "abc" });
      const run2 = TextRun.create({ content: "defg" });
      textBlock.appendRun(run1);
      textBlock.appendRun(run2);

      const layout = doLayout(textBlock);
      const run1Layout = layout.lines[0].runs[0];
      const run2Layout = layout.lines[0].runs[1];

      expect(run1Layout.range.yLength()).to.equal(textHeight);
      expect(run2Layout.range.yLength()).to.equal(textHeight);

      expect(run1Layout.offsetFromLine.y).to.equal(0);
      expect(run2Layout.offsetFromLine.y).to.equal(0);
    });

    it("aligns text of varying sizes to the baseline of the largest text", () => {
      const textBlock = TextBlock.create();
      const smallText = TextRun.create({ content: "small", styleOverrides: { textHeight: 1 } });
      const largeText = TextRun.create({ content: "large", styleOverrides: { textHeight: 3 } });
      textBlock.appendRun(smallText);
      textBlock.appendRun(largeText);

      const layout = doLayout(textBlock);
      const smallLayout = layout.lines[0].runs[0];
      const largeLayout = layout.lines[0].runs[1];

      expect(smallLayout.range.yLength()).to.equal(1);
      expect(largeLayout.range.yLength()).to.equal(3);

      expect(largeLayout.offsetFromLine.y).to.equal(0);
      expect(smallLayout.offsetFromLine.y).to.equal(0);
    });

    it("aligns text to center based on height of the largest stacked fraction", () => {
      const textBlock = TextBlock.create();
      const fractionRun = FractionRun.create({ numerator: "1", denominator: "2", styleOverrides: { textHeight: 4 } });
      const textRun = TextRun.create({ content: "text", styleOverrides: { textHeight: 2 } });
      textBlock.appendRun(fractionRun);
      textBlock.appendRun(textRun);

      const layout = doLayout(textBlock);
      const fractionLayout = layout.lines[0].runs[0];
      const textLayout = layout.lines[0].runs[1];

      expect(round(fractionLayout.range.yLength(), 2)).to.equal(7);
      expect(textLayout.range.yLength()).to.equal(2);

      // Fraction should be defining the line height
      expect(fractionLayout.offsetFromLine.y).to.equal(0);
      expect(round(textLayout.offsetFromLine.y, 2)).to.equal(2.5);
    });

    it("aligns the largest non-fraction text to the center based on height of stacked fraction and aligns all other text to the baseline", () => {
      const textBlock = TextBlock.create();
      const smallText = TextRun.create({ content: "s", styleOverrides: { textHeight: 1 } });
      const mediumText = TextRun.create({ content: "m", styleOverrides: { textHeight: 2 } });
      const fraction = FractionRun.create({ numerator: "1", denominator: "2", styleOverrides: { textHeight: 4 } });
      textBlock.appendRun(smallText);
      textBlock.appendRun(mediumText);
      textBlock.appendRun(fraction);

      const layout = doLayout(textBlock);
      const smallLayout = layout.lines[0].runs[0];
      const mediumLayout = layout.lines[0].runs[1];
      const fractionLayout = layout.lines[0].runs[2];

      expect(smallLayout.range.yLength()).to.equal(1);
      expect(mediumLayout.range.yLength()).to.equal(2);
      expect(round(fractionLayout.range.yLength(), 2)).to.equal(7);

      expect(round(mediumLayout.offsetFromLine.y, 2)).to.equal(2.5);
      expect(round(smallLayout.offsetFromLine.y, 2)).to.equal(2.5);
      expect(fractionLayout.offsetFromLine.y).to.equal(0);
    });

    it("aligns fractions to the baseline of same sized text", () => {
      const textBlock = TextBlock.create();
      const text = TextRun.create({ content: "t", styleOverrides: { textHeight: 3 } });
      const fraction = FractionRun.create({ numerator: "1", denominator: "2", styleOverrides: { textHeight: 3 } });

      textBlock.appendRun(text);
      textBlock.appendRun(fraction);

      const layout = doLayout(textBlock);
      const textLayout = layout.lines[0].runs[0];
      const fractionLayout = layout.lines[0].runs[1];

      expect(textLayout.range.yLength()).to.equal(3);
      expect(round(fractionLayout.range.yLength(), 2)).to.equal(5.25);

      expect(round(textLayout.offsetFromLine.y, 3)).to.equal(1.125);

      // Slightly lower than text baseline so that the fraction appears centered on the text
      expect(round(fractionLayout.offsetFromLine.y, 3)).to.equal(0.075);
    });

    it("produces one line per paragraph if document width <= 0", () => {
      const lineSpacingFactor = 0.5;
      const paragraphSpacingFactor = 0.25;
      const textHeight = TextStyleSettings.defaultProps.textHeight;
      const textBlock = TextBlock.create({ styleOverrides: { paragraphSpacingFactor, lineSpacingFactor } });
      for (let i = 0; i < 4; i++) {
        const layout = doLayout(textBlock);
        if (i === 0) {
          expect(layout.range.isNull).to.be.true;
        } else {
          expect(layout.lines.length).to.equal(i);
          expect(layout.range.low.x).to.equal(0);
          expect(layout.range.low.y).to.equal((-i - ((i - 1) * (lineSpacingFactor + paragraphSpacingFactor))) * textHeight);
          expect(layout.range.high.x).to.equal(i * 3);
          expect(layout.range.high.y).to.equal(0);
        }

        for (let l = 0; l < layout.lines.length; l++) {
          const line = layout.lines[l];
          expect(line.runs.length).to.equal(l + 1);
          expect(line.range.low.x).to.equal(0);
          expect(line.range.low.y).to.equal(0);
          expect(line.range.high.y).to.equal(textHeight);
          expect(line.range.high.x).to.equal(3 * (l + 1));
          for (const run of line.runs) {
            expect(run.charOffset).to.equal(0);
            expect(run.numChars).to.equal(3);
            expect(run.range.low.x).to.equal(0);
            expect(run.range.low.y).to.equal(0);
            expect(run.range.high.x).to.equal(3);
            expect(run.range.high.y).to.equal(textHeight);
          }
        }

        const p = textBlock.appendParagraph();
        for (let j = 0; j <= i; j++) {
          p.children.push(TextRun.create({ content: "Run" }));
        }
      }
    });

    it("produces a new line for each LineBreakRun", () => {
      const lineSpacingFactor = 0.5;
      const textHeight = 1;
      const textBlock = TextBlock.create({ styleOverrides: { lineSpacingFactor, textHeight } });
      textBlock.appendRun(TextRun.create({ content: "abc" }));
      textBlock.appendRun(LineBreakRun.create());
      textBlock.appendRun(TextRun.create({ content: "def" }));
      textBlock.appendRun(TextRun.create({ content: "ghi" }));
      textBlock.appendRun(LineBreakRun.create());
      textBlock.appendRun(TextRun.create({ content: "jkl" }));

      const tb = doLayout(textBlock);
      expect(tb.lines.length).to.equal(3);
      expect(tb.lines[0].runs.length).to.equal(2);
      expect(tb.lines[1].runs.length).to.equal(3);
      expect(tb.lines[2].runs.length).to.equal(1);

      expect(tb.range.low.x).to.equal(0);
      expect(tb.range.high.x).to.equal(6);
      expect(tb.range.high.y).to.equal(0);
      // paragraphSpacingFactor should not be applied to linebreaks, but lineSpacingFactor should.
      expect(tb.range.low.y).to.equal(-(lineSpacingFactor * 2 + textHeight * 3));
    });

    it("applies tab shifts", () => {
      const textHeight = 1;
      const tabInterval = 6;
      const textBlock = TextBlock.create({ styleOverrides: { textHeight, tabInterval } });

      // Appends a line that looks like `stringOne` TAB `stringTwo` LINEBREAK
      const appendLine = (stringOne: string, stringTwo: string, wantLineBreak: boolean = true) => {
        if (stringOne.length > 0) textBlock.appendRun(TextRun.create({ content: stringOne }));
        textBlock.appendRun(TabRun.create({ styleOverrides: { tabInterval } }));
        if (stringTwo.length > 0) textBlock.appendRun(TextRun.create({ content: stringTwo }));
        if (wantLineBreak) textBlock.appendRun(LineBreakRun.create());
      }

      // The extra comments are intentional to show where the tab stops should be.
      appendLine("", /*______*/ "a");
      appendLine("", /*______*/ "bc");
      appendLine("a", /*_____*/ "a");
      appendLine("bc", /*____*/ "bc");
      appendLine("cde", /*___*/ "cde");
      appendLine("cdefg", /*_*/ "cde"); // this one is the max tab distance before needing to move to the next tab stop
      appendLine("cdefgh", /*______*/ "cde"); // This one should push to the next tab stop.
      appendLine("cdefghi", /*_____*/ "cde", false); // This one should push to the next tab stop.

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
      const textHeight = 1;
      const tabInterval = 6;
      const textBlock = TextBlock.create({ styleOverrides: { textHeight, tabInterval } });

      // line 0: ----->----->----->LINEBREAK
      textBlock.appendRun(TabRun.create({ styleOverrides: { tabInterval } }));
      textBlock.appendRun(TabRun.create({ styleOverrides: { tabInterval } }));
      textBlock.appendRun(TabRun.create({ styleOverrides: { tabInterval } }));
      textBlock.appendRun(LineBreakRun.create());

      // line 1: abc-->----->LINEBREAK
      textBlock.appendRun(TextRun.create({ content: "abc" }));
      textBlock.appendRun(TabRun.create({ styleOverrides: { tabInterval } }));
      textBlock.appendRun(TabRun.create({ styleOverrides: { tabInterval } }));
      textBlock.appendRun(LineBreakRun.create());

      // line 2: abc--->->------>LINEBREAK
      textBlock.appendRun(TextRun.create({ content: "abc" }));
      textBlock.appendRun(TabRun.create({ styleOverrides: { tabInterval: 7 } }));
      textBlock.appendRun(TabRun.create({ styleOverrides: { tabInterval: 2 } }));
      textBlock.appendRun(TabRun.create({ styleOverrides: { tabInterval: 7 } }));
      textBlock.appendRun(LineBreakRun.create());

      // line 3: abc--->1/23->abcde->LINEBREAK
      textBlock.appendRun(TextRun.create({ content: "abc" }));
      textBlock.appendRun(TabRun.create({ styleOverrides: { tabInterval: 7 } }));
      textBlock.appendRun(FractionRun.create({ numerator: "1", denominator: "23" }));
      textBlock.appendRun(TabRun.create({ styleOverrides: { tabInterval: 3 } }));
      textBlock.appendRun(TextRun.create({ content: "abcde" }));
      textBlock.appendRun(TabRun.create({ styleOverrides: { tabInterval: 7 } }));
      textBlock.appendRun(LineBreakRun.create());

      const tb = doLayout(textBlock);

      const line0 = tb.lines[0];
      const line1 = tb.lines[1];
      const line2 = tb.lines[2];
      const line3 = tb.lines[3];

      expect(line0.runs.length).to.equal(4);
      expect(line0.range.xLength()).to.equal(3 * tabInterval, `Lines with tabs should have the correct range length`);

      expect(line1.runs.length).to.equal(4);
      expect(line1.range.xLength()).to.equal(2 * tabInterval, `Tabs should be applied correctly when they are at the end of a line`);

      expect(line2.runs.length).to.equal(5);
      expect(line2.range.xLength()).to.equal(7 + 2 + 7, `Multiple tabs with different intervals should be applied correctly`);

      expect(line3.runs.length).to.equal(7);
      expect(line3.range.xLength()).to.equal(7 + 3 + 7, `Multiple tabs with different intervals should be applied correctly`);
    });

    it("computes ranges based on custom line spacing, text height, and indentation", () => {
      const lineSpacingFactor = 2;
      const textHeight = 3;
      const paragraphSpacingFactor = 13;
      const indentation = 7;

      const textBlock = TextBlock.create({ styleOverrides: { lineSpacingFactor, textHeight, paragraphSpacingFactor, indentation } });
      textBlock.appendRun(TextRun.create({ content: "abc" }));
      textBlock.appendRun(LineBreakRun.create());
      textBlock.appendRun(TextRun.create({ content: "def" }));
      textBlock.appendRun(TextRun.create({ content: "ghi" }));
      textBlock.appendRun(LineBreakRun.create());
      textBlock.appendRun(TextRun.create({ content: "jkl" }));

      const tb = doLayout(textBlock);
      expect(tb.lines.length).to.equal(3);
      expect(tb.lines[0].runs.length).to.equal(2);
      expect(tb.lines[1].runs.length).to.equal(3);
      expect(tb.lines[2].runs.length).to.equal(1);

      /* Final TextBlock should look like:
        ⇥abc↵
        ⇥defghi↵
        ⇥jkl

        Where ↵ = LineBreak, ¶ = ParagraphBreak, ⇥ = indentation

        We have 3 lines each `textHeight` high, plus 2 line breaks in between each `textHeight*lineSpacingFactor` high.
        No paragraph spacing should be applied since there is one paragraph.
      */

      expect(tb.range.low.x).to.equal(7);
      expect(tb.range.high.x).to.equal(6 + 7); // 7 for indentation, 6 for the length of "defghi"
      expect(tb.range.high.y).to.equal(0);
      expect(tb.range.low.y).to.equal(-(textHeight * 3 + (textHeight * lineSpacingFactor) * 2));

      expect(tb.lines[0].offsetFromDocument.y).to.equal(-textHeight);
      expect(tb.lines[1].offsetFromDocument.y).to.equal(tb.lines[0].offsetFromDocument.y - (textHeight + textHeight * lineSpacingFactor));
      expect(tb.lines[2].offsetFromDocument.y).to.equal(tb.lines[1].offsetFromDocument.y - (textHeight + textHeight * lineSpacingFactor));

      tb.lines.forEach((line) => expect(line.offsetFromDocument.x).to.equal(7));
    });

    it("computes paragraph spacing and indentation", () => {
      const lineSpacingFactor = 2;
      const textHeight = 3;
      const paragraphSpacingFactor = 13;
      const indentation = 7;
      const tabInterval = 5;
      const textBlock = TextBlock.create({ styleOverrides: { lineSpacingFactor, textHeight, paragraphSpacingFactor, indentation, tabInterval } });

      const p1 = textBlock.appendParagraph();
      p1.children.push(TextRun.create({ content: "abc" })); // Line 1
      p1.children.push(LineBreakRun.create());
      p1.children.push(TextRun.create({ content: "def" })); // Line 2

      const p2 = textBlock.appendParagraph();
      p2.children.push(TextRun.create({ content: "ghi" })); // Line 3

      const list = List.create();
      list.children.push(Paragraph.create({ children: [{ type: "text", content: "list item 1" }] })); // Line 4
      list.children.push(Paragraph.create({ children: [{ type: "text", content: "list item 2" }] })); // Line 5
      list.children.push(Paragraph.create({ children: [{ type: "text", content: "list item 3" }] })); // Line 6
      p2.children.push(list);

      const tb = doLayout(textBlock);
      expect(tb.lines.length).to.equal(6);

      /* Final TextBlock should look like:
        ⇥abc↵
        ⇥def¶
        ⇥ghi¶
        ⇥￫1. list item 1¶
        ⇥￫2. list item 2¶
        ⇥￫3. list item 3

        Where ↵ = LineBreak, ¶ = ParagraphBreak, ￫ = tabInterval/2, ⇥ = indentation

        We have:
          6 lines each `textHeight` high
          5 line breaks in between each `textHeight*lineSpacingFactor` high
          4 paragraph breaks in between each `textHeight*paragraphSpacingFactor` high
      */

      expect(tb.range.low.x).to.equal(7); // 7 for indentation
      expect(tb.range.high.x).to.equal(7 + 5 + 11); // 7 for indentation, 5 for the tab stop, 11 for the length of "list item 1"
      expect(tb.range.high.y).to.equal(0);
      expect(tb.range.low.y).to.equal(-(textHeight * 6 + (textHeight * lineSpacingFactor) * 5 + (textHeight * paragraphSpacingFactor) * 4));

      // Cumulative vertical offsets to help make the test more readable.
      let offsetY = -textHeight;
      let offsetX = indentation;

      expect(tb.lines[0].offsetFromDocument.y).to.equal(offsetY);
      expect(tb.lines[0].offsetFromDocument.x).to.equal(offsetX);

      offsetY -= (textHeight + textHeight * lineSpacingFactor);
      expect(tb.lines[1].offsetFromDocument.y).to.equal(offsetY);
      expect(tb.lines[1].offsetFromDocument.x).to.equal(offsetX);

      offsetY -= (textHeight + textHeight * lineSpacingFactor + textHeight * paragraphSpacingFactor);
      expect(tb.lines[2].offsetFromDocument.y).to.equal(offsetY);
      expect(tb.lines[2].offsetFromDocument.x).to.equal(offsetX);

      offsetX += tabInterval; // List items are indented using tabInterval.
      offsetY -= (textHeight + textHeight * lineSpacingFactor + textHeight * paragraphSpacingFactor);
      expect(tb.lines[3].offsetFromDocument.y).to.equal(offsetY);
      expect(tb.lines[3].offsetFromDocument.x).to.equal(offsetX);

      offsetY -= (textHeight + textHeight * lineSpacingFactor + textHeight * paragraphSpacingFactor);
      expect(tb.lines[4].offsetFromDocument.y).to.equal(offsetY);
      expect(tb.lines[4].offsetFromDocument.x).to.equal(offsetX);

      offsetY -= (textHeight + textHeight * lineSpacingFactor + textHeight * paragraphSpacingFactor);
      expect(tb.lines[5].offsetFromDocument.y).to.equal(offsetY);
      expect(tb.lines[5].offsetFromDocument.x).to.equal(offsetX);
    });

    function expectRange(width: number, height: number, range: Range2d): void {
      expect(range.xLength()).to.equal(width);
      expect(range.yLength()).to.equal(height);
    }

    it("computes range for wrapped lines", function () {
      if (!isIntlSupported()) {
        this.skip();
      }
      const textHeight = TextStyleSettings.defaultProps.textHeight;
      const block = TextBlock.create({ width: 3, styleOverrides: { lineSpacingFactor: 0 } });

      function expectBlockRange(width: number, height: number): void {
        const layout = doLayout(block);
        expectRange(width, height, layout.range);
      }

      block.appendRun(makeTextRun("abc"));
      expectBlockRange(3, textHeight);

      block.appendRun(makeTextRun("defg"));
      expectBlockRange(4, 2 * textHeight);

      block.width = 1;
      expectBlockRange(4, 2 * textHeight);

      block.width = 8;
      expectBlockRange(8, textHeight);

      block.width = 6;
      expectBlockRange(6, 2 * textHeight);

      block.width = 10;
      expectBlockRange(10, textHeight);
      block.appendRun(makeTextRun("hijk"));
      expectBlockRange(10, 2 * textHeight);
    });

    it("computes range for split runs", function () {
      if (!isIntlSupported()) {
        this.skip();
      }
      const textHeight = 1;
      const block = TextBlock.create({ styleOverrides: { textHeight, lineSpacingFactor: 0 } });

      function expectBlockRange(width: number, height: number): void {
        const layout = doLayout(block);
        expectRange(width, height, layout.range);
      }

      const sentence = "a bc def ghij klmno";
      expect(sentence.length).to.equal(19);
      block.appendRun(makeTextRun(sentence));

      block.width = 19;
      expectBlockRange(19, textHeight);

      block.width = 10;
      expectBlockRange(10, 2 * textHeight);
    });

    it("computes range for list markers and list items based on indentation", function () {
      const lineSpacingFactor = 2;
      const textHeight = 3;
      const paragraphSpacingFactor = 13;
      const indentation = 7;
      const tabInterval = 5;

      const listChildren: ParagraphProps[] = [
        {
          children: [
            {
              type: "text",
              content: "Oranges",
            }
          ]
        },
        {
          children: [
            {
              type: "text",
              content: "Apples",
            },
            {
              type: "list",
              styleOverrides: { listMarker: { enumerator: ListMarkerEnumerator.Bullet } },
              children: [
                {
                  children: [
                    {
                      type: "text",
                      content: "Red",
                    }
                  ]
                },
                {
                  children: [
                    {
                      type: "text",
                      content: "Green",
                    },
                    {
                      type: "list",
                      styleOverrides: { listMarker: { enumerator: ListMarkerEnumerator.RomanNumeral, case: "lower", terminator: "period" } },
                      children: [
                        {
                          children: [
                            {
                              type: "text",
                              content: "Granny Smith",
                            }
                          ]
                        },
                        {
                          children: [
                            {
                              type: "text",
                              content: "Rhode Island Greening",
                            }
                          ]
                        }
                      ]
                    }
                  ]
                },
                {
                  children: [
                    {
                      type: "text",
                      content: "Yellow",
                    }
                  ]
                }
              ]
            }
          ]
        }
      ];

      const textBlock = TextBlock.create({ styleOverrides: { lineSpacingFactor, textHeight, paragraphSpacingFactor, indentation, tabInterval } });
      const p1 = textBlock.appendParagraph();
      p1.children.push(List.create({ children: listChildren }));

      /* Final TextBlock should look like:
      ￫1.￫Oranges¶
      ￫2.￫Apples¶
        →￫•￫Red¶
        →￫•￫Green¶
        → →￫i. ￫Granny Smith¶
        → →￫ii.￫Rhode Island Greening¶
        →￫•￫Yellow

        Where ↵ = LineBreak, ¶ = ParagraphBreak, → = tab, ￫ = tabInterval/2, ⇥ = indentation

        We have:
          7 lines each `textHeight` high
          6 line breaks in between each `textHeight*lineSpacingFactor` high
          6 paragraph breaks in between each `textHeight*paragraphSpacingFactor` high
      */

      const tb = doLayout(textBlock);
      expect(tb.lines.length).to.equal(7);

      expect(tb.range.low.x).to.equal(7 + 5 - 5 / 2 - 2); // indentation + tabInterval - tabInterval/2 (for marker offset) + 2 (for the marker "1." justification, it's 2 characters wide)
      expect(tb.range.high.x).to.equal(7 + 3 * 5 + 21); // 7 for indentation, 3 * 5 for the most nested tab stops, 21 for the length of "Rhode Island Greening"
      expect(tb.range.high.y).to.equal(0);
      expect(tb.range.low.y).to.equal(-(textHeight * 7 + (textHeight * lineSpacingFactor) * 6 + (textHeight * paragraphSpacingFactor) * 6));

      // Cumulative vertical offsets to help make the test more readable.
      let offsetY = -textHeight;

      for (const line of tb.lines) {
        expect(line.offsetFromDocument.y).to.equal(offsetY);
        expect(line.marker).to.not.be.undefined;
        expect(line.marker?.offsetFromLine.y).to.equal((textHeight - line.marker!.range.yLength()) / 2);
        offsetY -= (textHeight + textHeight * lineSpacingFactor + textHeight * paragraphSpacingFactor);
      }

      let markerXLength = tb.lines[0].marker!.range.xLength();
      let inset = indentation + tabInterval;
      expect(tb.lines[0].offsetFromDocument.x).to.equal(inset); // →Oranges
      expect(markerXLength).to.equal(2); // "1." is 2 characters wide
      expect(tb.lines[0].marker!.offsetFromLine.x).to.equal(0 - markerXLength - (tabInterval / 2));

      markerXLength = tb.lines[1].marker!.range.xLength();
      expect(tb.lines[1].offsetFromDocument.x).to.equal(inset); // →Apples
      expect(tb.lines[1].marker!.offsetFromLine.x).to.equal(0 - markerXLength - (tabInterval / 2));

      markerXLength = tb.lines[2].marker!.range.xLength();
      inset = indentation + tabInterval * 2;
      expect(tb.lines[2].offsetFromDocument.x).to.equal(indentation + tabInterval * 2); // →→Red
      expect(tb.lines[2].marker!.offsetFromLine.x).to.equal(0 - markerXLength - (tabInterval / 2));

      markerXLength = tb.lines[3].marker!.range.xLength();
      expect(tb.lines[3].offsetFromDocument.x).to.equal(indentation + tabInterval * 2); // →→Green
      expect(tb.lines[3].marker!.offsetFromLine.x).to.equal(0 - markerXLength - (tabInterval / 2));

      markerXLength = tb.lines[4].marker!.range.xLength();
      expect(tb.lines[4].offsetFromDocument.x).to.equal(indentation + tabInterval * 3); // →→→Granny Smith
      expect(tb.lines[4].marker!.offsetFromLine.x).to.equal(0 - markerXLength - (tabInterval / 2));

      markerXLength = tb.lines[5].marker!.range.xLength();
      expect(tb.lines[5].offsetFromDocument.x).to.equal(indentation + tabInterval * 3); // →→→Rhode Island Greening
      expect(tb.lines[5].marker!.offsetFromLine.x).to.equal(0 - markerXLength - (tabInterval / 2));

      markerXLength = tb.lines[6].marker!.range.xLength();
      expect(tb.lines[6].offsetFromDocument.x).to.equal(indentation + tabInterval * 2); // →→Yellow
      expect(tb.lines[6].marker!.offsetFromLine.x).to.equal(0 - markerXLength - (tabInterval / 2));
    });

    it("justifies lines", function () {
      if (!isIntlSupported()) {
        this.skip();
      }

      const block = TextBlock.create({ styleOverrides: { lineSpacingFactor: 0 } });
      const textHeight = TextStyleSettings.defaultProps.textHeight;
      function expectBlockRange(width: number, height: number, justification: TextJustification): void {
        const layout = doLayout(block, {
          findTextStyle: () => TextStyleSettings.fromJSON({ justification })
        });
        expectRange(width, height, layout.range);
      }

      function expectLineOffset(offset: number, lineIndex: number, justification: TextJustification): void {
        const layout = doLayout(block, {
          findTextStyle: () => TextStyleSettings.fromJSON({ justification }),
        });
        expect(layout.lines.length).least(lineIndex + 1);

        const line = layout.lines[lineIndex];
        expect(line.offsetFromDocument.y).to.equal(-((lineIndex + 1) * textHeight));
        expect(line.offsetFromDocument.x).to.equal(offset);
      }

      // Two text runs with 7 characters total.
      block.appendRun(makeTextRun("abc"));
      block.appendRun(makeTextRun("defg"));

      // 1 line of text with width 0: left, right, center justification.
      expectBlockRange(7, textHeight, "left");
      expectLineOffset(0, 0, "left");

      expectBlockRange(7, textHeight, "right");
      expectLineOffset(0, 0, "right");

      expectBlockRange(7, textHeight, "center");
      expectLineOffset(0, 0, "center");

      // 1 line of text from a width greater than number of characters: left, right, center justification.
      block.width = 10;

      expectBlockRange(10, textHeight, "left");
      expectLineOffset(0, 0, "left");

      expectBlockRange(10, textHeight, "right");
      expectLineOffset(3, 0, "right"); // 3 = 10 - 7

      expectBlockRange(10, textHeight, "center");
      expectLineOffset(1.5, 0, "center"); // 1.5 = (10 - 7) / 2

      // 2 line of text from a width less than number of characters: left, right, center justification.
      block.width = 4;
      expectBlockRange(4, 2 * textHeight, "left");
      expectLineOffset(0, 0, "left");
      expectLineOffset(0, 1, "left");

      expectBlockRange(4, 2 * textHeight, "right");
      expectLineOffset(1, 0, "right");
      expectLineOffset(0, 1, "right");

      expectBlockRange(4, 2 * textHeight, "center");
      expectLineOffset(0.5, 0, "center");
      expectLineOffset(0, 1, "center");

      // Testing text longer the the width of the text block.
      block.width = 2;
      expectBlockRange(4, 2 * textHeight, "left");
      expectLineOffset(0, 0, "left");
      expectLineOffset(0, 1, "left");

      expectBlockRange(4, 2 * textHeight, "right");
      expectLineOffset(-1, 0, "right");
      expectLineOffset(-2, 1, "right");

      block.appendRun(makeTextRun("123456789"));
      expectBlockRange(9, 3 * textHeight, "right");
      expectLineOffset(-1, 0, "right");
      expectLineOffset(-2, 1, "right");
      expectLineOffset(-7, 2, "right");

      expectBlockRange(9, 3 * textHeight, "center");
      expectLineOffset(-0.5, 0, "center");
      expectLineOffset(-1, 1, "center");
      expectLineOffset(-3.5, 2, "center");
    });
  });

  describe("word-wrapping", () => {

    function expectLines(input: string, width: number, expectedLines: string[]): TextBlockLayout {
      const textBlock = TextBlock.create({ styleOverrides: { paragraphSpacingFactor: 0, lineSpacingFactor: 0, textHeight: 1 } });
      textBlock.width = width;
      const run = makeTextRun(input);
      textBlock.appendRun(run);

      const layout = doLayout(textBlock);
      const content = run.stringify();
      expect(layout.lines.every((line) => line.runs.every((r) => r.source.stringify() === content))).to.be.true;

      const actual = layout.lines.map((line) => line.runs.map((runLayout) => (runLayout.source as TextRun).content.substring(runLayout.charOffset, runLayout.charOffset + runLayout.numChars)).join(""));
      expect(actual).to.deep.equal(expectedLines);

      return layout;
    }

    it("splits paragraphs into multiple lines if runs exceed the document width", function () {
      if (!isIntlSupported()) {
        this.skip();
      }

      const textBlock = TextBlock.create();
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

    it("wraps tabs", function () {
      if (!isIntlSupported()) {
        this.skip();
      }

      const textHeight = 1;
      const textBlock = TextBlock.create({ styleOverrides: { textHeight } });

      // line 0:  -->-->------> LINEBREAK
      textBlock.appendRun(TabRun.create({ styleOverrides: { tabInterval: 3 } }));
      textBlock.appendRun(TabRun.create({ styleOverrides: { tabInterval: 3 } }));
      textBlock.appendRun(TabRun.create({ styleOverrides: { tabInterval: 7 } }));
      textBlock.appendRun(LineBreakRun.create());

      // line 1:  a->b->cd-----> LINEBREAK
      textBlock.appendRun(TextRun.create({ content: "a" }));
      textBlock.appendRun(TabRun.create({ styleOverrides: { tabInterval: 3 } }));
      textBlock.appendRun(TextRun.create({ content: "b" }));
      textBlock.appendRun(TabRun.create({ styleOverrides: { tabInterval: 3 } }));
      textBlock.appendRun(TextRun.create({ content: "cd" }));
      textBlock.appendRun(TabRun.create({ styleOverrides: { tabInterval: 7 } }));
      textBlock.appendRun(LineBreakRun.create());

      // line 2:  -->a->b------>cd LINEBREAK
      textBlock.appendRun(TabRun.create({ styleOverrides: { tabInterval: 3 } }));
      textBlock.appendRun(TextRun.create({ content: "a" }));
      textBlock.appendRun(TabRun.create({ styleOverrides: { tabInterval: 3 } }));
      textBlock.appendRun(TextRun.create({ content: "b" }));
      textBlock.appendRun(TabRun.create({ styleOverrides: { tabInterval: 7 } }));
      textBlock.appendRun(TextRun.create({ content: "cd" }));
      textBlock.appendRun(LineBreakRun.create());

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

      const textBlock = TextBlock.create();
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

      const block = TextBlock.create();
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

      const block = TextBlock.create({ styleOverrides: { textHeight: 1, lineSpacingFactor: 0 } });
      block.appendRun(makeTextRun("abc defg"));
      const layout1 = doLayout(block);
      let width = layout1.range.xLength();
      // Simulate a floating point rounding error by slightly reducing the width
      width -= Geometry.smallFloatingPoint;
      block.width = width;
      const layout2 = doLayout(block);
      expect(layout2.range.yLength()).to.equal(1);
    })

    it("wraps list items and applies indentation/insets for narrow text block width", function () {
      if (!isIntlSupported()) {
        this.skip();
      }

      const textBlock = TextBlock.create({ styleOverrides: { indentation: 2, tabInterval: 3, textHeight: 1, lineSpacingFactor: 0, paragraphSpacingFactor: 0 } });

      /* Final TextBlock should look like:
        ⇥￫1.￫Lorem ipsum dolor sit amet, consectetur adipiscing elit¶     | Inset by 5
        ⇥￫2.￫sed do¶                                                      | Inset by 5
        ⇥→￫a.￫eiusmod tempor¶                                             | Inset by 8
        ⇥→￫b.￫incididunt ut labore et dolore magna aliqua                 | Inset by 8

        Where ↵ = LineBreak, ¶ = ParagraphBreak, → = tab, ￫ = tabInterval/2, ⇥ = indentation
      */

      // Create nested list structure
      const list = List.create();
      list.children.push(Paragraph.create({ children: [TextRun.create({ content: "Lorem ipsum dolor sit amet, consectetur adipiscing elit" })] }));
      const apples = Paragraph.create({ children: [TextRun.create({ content: "sed do" })] });

      const subList = List.create({ styleOverrides: { listMarker: { enumerator: ListMarkerEnumerator.Letter, case: "lower", terminator: "period" } } });
      subList.children.push(Paragraph.create({ children: [TextRun.create({ content: "eiusmod tempor" })] }));
      subList.children.push(Paragraph.create({ children: [TextRun.create({ content: "incididunt ut labore et dolore magna aliqua" })] }));

      apples.children.push(subList);
      list.children.push(apples);

      textBlock.appendParagraph().children.push(list);


      function expectLayout(width: number, expected: string): void {
        textBlock.width = width;
        const layout = doLayout(textBlock);

        // Check that each line is wrapped to width
        const minWidth = Math.max(19, width); // 19 for the width of the longest word with inset: "⇥→￫b.￫incididunt "
        if (width > 0) {
          layout.lines.forEach((line) => {
            expect(line.justificationRange.xLength() + line.offsetFromDocument.x).to.be.at.most(minWidth);
          });
        }


        expect(layout.stringify()).to.equal(expected);

        // Top-level items should have indentation + tabInterval
        let inset = 2 + 3;
        layout.lines.forEach((line) => {
          if (line.stringify().includes("eiusmod")) inset += 3; // SubList items should have increased indentation

          expect(line.offsetFromDocument.x).to.equal(inset);
        });
      }

      // Check indentation/insets for each line, indentation: 2, tabInterval: 5
      expectLayout(0, "Lorem ipsum dolor sit amet, consectetur adipiscing elit\nsed do\neiusmod tempor\nincididunt ut labore et dolore magna aliqua");
      expectLayout(70, "Lorem ipsum dolor sit amet, consectetur adipiscing elit\nsed do\neiusmod tempor\nincididunt ut labore et dolore magna aliqua");
      expectLayout(40, "Lorem ipsum dolor sit amet, \nconsectetur adipiscing elit\nsed do\neiusmod tempor\nincididunt ut labore et dolore \nmagna aliqua");
      // TODO: layout should not pay attention to trailing whitespace when wrapping. I'll do this in another PR.
      expectLayout(21, "Lorem ipsum \ndolor sit amet, \nconsectetur \nadipiscing elit\nsed do\neiusmod \ntempor\nincididunt \nut labore et \ndolore magna \naliqua");
      expectLayout(15, "Lorem \nipsum \ndolor sit \namet, \nconsectetur \nadipiscing \nelit\nsed do\neiusmod \ntempor\nincididunt \nut \nlabore \net \ndolore \nmagna \naliqua");
    });
  });

  describe("grapheme offsets", () => {
    function getLayoutResultAndStyleResolver(textBlock: TextBlock): { textStyleResolver: TextStyleResolver, result: TextBlockLayoutResult } {
      const layout = doLayout(textBlock);
      const result = layout.toResult();
      const textStyleResolver = new TextStyleResolver({
        textBlock,
        textStyleId: "",
        iModel: {} as any,
        findTextStyle: () => TextStyleSettings.defaults
      });
      return { textStyleResolver, result };
    }

    it("should return an empty array if source type is not text", function () {
      const textBlock = TextBlock.create();
      const fractionRun = FractionRun.create({ numerator: "1", denominator: "2" });
      textBlock.appendRun(fractionRun);

      const { textStyleResolver, result } = getLayoutResultAndStyleResolver(textBlock);
      const source = textBlock.children[0]; // FractionRun is not a TextRun
      const args: ComputeGraphemeOffsetsArgs = {
        source,
        iModel: {} as any,
        textStyleResolver,
        findFontId: () => 0,
        computeTextRange: computeTextRangeAsStringLength,
        runLayoutResult: result.lines[0].runs[0],
        graphemeCharIndexes: [0],
      };
      const graphemeRanges = computeGraphemeOffsets(args);

      expect(graphemeRanges).to.be.an("array").that.is.empty;
    });

    it("should handle empty text content", function () {
      const textBlock = TextBlock.create();
      const textRun = TextRun.create({ content: "" });
      textBlock.appendRun(textRun);

      const { textStyleResolver, result } = getLayoutResultAndStyleResolver(textBlock);
      const source = textBlock.children[0]; // FractionRun is not a TextRun
      const args: ComputeGraphemeOffsetsArgs = {
        source,
        iModel: {} as any,
        textStyleResolver,
        findFontId: () => 0,
        computeTextRange: computeTextRangeAsStringLength,
        runLayoutResult: result.lines[0].runs[0],
        graphemeCharIndexes: [0], // Supply a grapheme index even though there is no text
      };
      const graphemeRanges = computeGraphemeOffsets(args);

      expect(graphemeRanges).to.be.an("array").that.is.empty;
    });

    it("should compute grapheme offsets correctly for a given text", function () {
      const textBlock = TextBlock.create();
      const textRun = TextRun.create({ content: "hello" });
      textBlock.appendRun(textRun);

      const { textStyleResolver, result } = getLayoutResultAndStyleResolver(textBlock);
      const source = textBlock.children[0].children[0];
      const args: ComputeGraphemeOffsetsArgs = {
        source,
        iModel: {} as any,
        textStyleResolver,
        findFontId: () => 0,
        computeTextRange: computeTextRangeAsStringLength,
        runLayoutResult: result.lines[0].runs[0],
        graphemeCharIndexes: [0, 1, 2, 3, 4],
      };
      const graphemeRanges = computeGraphemeOffsets(args);

      expect(graphemeRanges).to.be.an("array").that.has.lengthOf(5);
      expect(graphemeRanges[0].high.x).to.equal(1);
      expect(graphemeRanges[4].high.x).to.equal(5);
    });

    it("should compute grapheme offsets correctly for non-English text", function () {
      const textBlock = TextBlock.create();
      // Hindi - "Paragraph"
      const textRun = TextRun.create({ content: "अनुच्छेद" });
      textBlock.appendRun(textRun);

      const { textStyleResolver, result } = getLayoutResultAndStyleResolver(textBlock);
      const source = textBlock.children[0].children[0];
      const args: ComputeGraphemeOffsetsArgs = {
        source,
        iModel: {} as any,
        textStyleResolver,
        findFontId: () => 0,
        computeTextRange: computeTextRangeAsStringLength,
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
      const textBlock = TextBlock.create();
      const textRun = TextRun.create({ content: "👨‍👦" });
      textBlock.appendRun(textRun);

      const { textStyleResolver, result } = getLayoutResultAndStyleResolver(textBlock);
      const source = textBlock.children[0].children[0];
      const args: ComputeGraphemeOffsetsArgs = {
        source,
        iModel: {} as any,
        textStyleResolver,
        findFontId: () => 0,
        computeTextRange: computeTextRangeAsStringLength,
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
        const textBlock = TextBlock.create();
        textBlock.appendRun(TextRun.create({ styleOverrides: { font: { name: fontName } } }));
        const textStyleResolver = new TextStyleResolver({ textBlock, textStyleId: "", iModel });
        const layout = layoutTextBlock({ textBlock, iModel, textStyleResolver });
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
        styleOverrides: {
          textHeight: args.height,
          widthFactor: args.width,
        },
      });

      textBlock.appendRun(TextRun.create({
        content: args.content ?? "This is a string of text.",
        styleOverrides: {
          isBold: args.bold,
          isItalic: args.italic,
          font: { name: args.font ?? "Vera" },
        },
      }));

      const textStyleResolver = new TextStyleResolver({ textBlock, textStyleId: "", iModel });
      const range = layoutTextBlock({ textBlock, iModel, textStyleResolver }).range;
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
          textHeight: 1,
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
    return TextRun.create({ styleOverrides, content: "text" });
  }

  function makeFraction(color?: Color): FractionRun {
    const styleOverrides = undefined !== color ? { color: color instanceof ColorDef ? color.toJSON() : color } : undefined;
    return FractionRun.create({ numerator: "num", denominator: "denom", styleOverrides });
  }

  function makeBreak(color?: Color): LineBreakRun {
    const styleOverrides = undefined !== color ? { color: color instanceof ColorDef ? color.toJSON() : color } : undefined;
    return LineBreakRun.create({ styleOverrides });
  }

  function makeTextBlock(runs: Run[]): TextBlock {
    const block = TextBlock.create();
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

  function makeListGeometry(children: ParagraphProps[]): TextBlockGeometryPropsEntry[] {
    const textBlock = TextBlock.create();
    const p1 = textBlock.appendParagraph();
    p1.children.push(List.create({ children }));

    const annotation = TextAnnotation.fromJSON({ textBlock: textBlock.toJSON() });
    const layout = doLayout(textBlock);
    return produceTextBlockGeometry(layout, annotation.computeTransform(layout.range)).entries;
  }

  it("produces an empty array for an empty text block", () => {
    expect(makeGeometry([])).to.deep.equal([]);
  });

  it("produces an empty array for a block consisting of line breaks", () => {
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

  it("produces entries for list markers", () => {
    /* Final TextBlock should look like:
      1. Oranges                        // Oranges -> default "subcategory" text
      2. Apples                         // Apples -> Switch to red text
          • Red
          • Green                       // Green -> Switch to green text, not including the bullet.
            i.  Granny Smith
            ii. Rhode Island Greening
          • Yellow                      // Yellow -> Back to red text

        We have:
          7 lines each containing one TextString for the list marker and one for the text,
          4 appearance overrides
      */

    const listChildren: ParagraphProps[] = [
      {
        children: [
          {
            type: "text",
            content: "Oranges",
          }
        ]
      },
      {
        children: [
          {
            type: "text",
            content: "Apples",
          },
          {
            type: "list",
            styleOverrides: { listMarker: { enumerator: ListMarkerEnumerator.Bullet }, color: ColorDef.red.tbgr },
            children: [
              {
                children: [
                  {
                    type: "text",
                    content: "Red",
                  }
                ]
              },
              {
                styleOverrides: { color: ColorDef.green.tbgr },
                children: [
                  {
                    type: "text",
                    content: "Green",
                  },
                  {
                    type: "list",
                    styleOverrides: { listMarker: { enumerator: ListMarkerEnumerator.RomanNumeral, case: "lower", terminator: "period" } },
                    children: [
                      {
                        children: [
                          {
                            type: "text",
                            content: "Granny Smith",
                          }
                        ]
                      },
                      {
                        children: [
                          {
                            type: "text",
                            content: "Rhode Island Greening",
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                children: [
                  {
                    type: "text",
                    content: "Yellow",
                  }
                ]
              }
            ]
          }
        ]
      }
    ];

    const entries = makeListGeometry(listChildren);
    expect(entries.length).to.equal(14 + 4); // 14 text strings + 4 appearance entry

    expect(entries[0].color).to.equal("subcategory");
    expect(entries[1].text?.text).to.equal("1.");
    expect(entries[2].text?.text).to.equal("Oranges");
    expect(entries[3].text?.text).to.equal("2.");
    expect(entries[4].text?.text).to.equal("Apples");
    expect(entries[5].color).to.equal(ColorDef.red.tbgr);
    expect(entries[6].text?.text).to.equal("•");
    expect(entries[7].text?.text).to.equal("Red");
    expect(entries[8].text?.text).to.equal("•");
    expect(entries[9].color).to.equal(ColorDef.green.tbgr);
    expect(entries[10].text?.text).to.equal("Green");
    expect(entries[11].text?.text).to.equal("i.");
    expect(entries[12].text?.text).to.equal("Granny Smith");
    expect(entries[13].text?.text).to.equal("ii.");
    expect(entries[14].text?.text).to.equal("Rhode Island Greening");
    expect(entries[15].color).to.equal(ColorDef.red.tbgr);
    expect(entries[16].text?.text).to.equal("•");
    expect(entries[17].text?.text).to.equal("Yellow");

  });

  it("offsets geometry entries by margins", () => {
    const textHeight = TextStyleSettings.defaults.textHeight;
    function makeGeometryWithMargins(anchor: TextAnnotationAnchor, margins: TextBlockMargins): TextStringProps | undefined {
      const runs = [makeText()];
      const block = makeTextBlock(runs);
      const annotation = TextAnnotation.fromJSON({ textBlock: block.toJSON() });
      annotation.anchor = anchor;
      const layout = doLayout(block, {
        findTextStyle: () => TextStyleSettings.fromJSON({ margins: { ...margins } }),
      });
      const geom = produceTextBlockGeometry(layout, annotation.computeTransform(layout.range)).entries;

      return geom[1].text;
    }

    function testMargins(margins: Required<TextBlockMargins>, height: number, width: number) {
      // We want to disregard negative margins. Note, I'm not changing the margins object itself. It gets passed into makeGeometryWithMargins as it is.
      const left = margins.left >= 0 ? margins.left : 0;
      const right = margins.right >= 0 ? margins.right : 0;
      const top = margins.top >= 0 ? margins.top : 0;
      const bottom = margins.bottom >= 0 ? margins.bottom : 0;

      // Test case: bottom, left
      let props = makeGeometryWithMargins({ horizontal: "left", vertical: "bottom" }, margins);
      expect(props).not.to.be.undefined;
      expect(props?.origin, "Expected geometry to be offset by left and bottom margins").to.deep.equal({ x: left * textHeight, y: bottom * textHeight, z: 0 });

      // Test case: top, right
      props = makeGeometryWithMargins({ vertical: "top", horizontal: "right" }, margins);

      let x = (right * textHeight + width) * -1;
      let y = (top * textHeight + height) * -1;
      expect(props).not.to.be.undefined;
      expect(props?.origin, "Expected geometry to be offset by top and right margins").to.deep.equal({ x, y, z: 0 });

      // Test case: middle, center
      props = makeGeometryWithMargins({ vertical: "middle", horizontal: "center" }, margins);

      x = (left * textHeight - right * textHeight - width) / 2;
      y = (bottom * textHeight - top * textHeight - height) / 2;
      expect(props).not.to.be.undefined;
      expect(props?.origin, "Expected geometry to be centered in the margins").to.deep.equal({ x, y, z: 0 });
    }

    // xLength will be 4 because of the mock implementation on line 16.
    // yLength will be 1 because of the mock implementation on line 16.
    testMargins({ top: 0, right: 0, bottom: 0, left: 0 }, textHeight, 4);
    testMargins({ top: 1, right: 2, bottom: 3, left: 4 }, textHeight, 4);
    testMargins({ top: -1, right: -2, bottom: -3, left: -4 }, textHeight, 4);
  });
});

// Ignoring the text strings from the spell checker
// cspell:ignore jklmnop vwxyz defg hijk ghij klmno pqrstu Tanuki aabb eeff nggg amet adipiscing elit Phasellus pretium malesuada venenatis eleifend Donec sapien Nullam commodo accumsan lacinia metus enim pharetra lacus facilisis Duis suscipit quis feugiat fermentum ut augue Mauris iaculis odio rhoncus lorem viverra turpis elementum posuere Consolas अनुच्छेद cdefg cdefgh cdefghi eiusmod tempor incididunt ut labore et dolore magna aliqua sed defghi