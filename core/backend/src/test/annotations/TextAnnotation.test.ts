/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ComputeRangesForTextLayout, ComputeRangesForTextLayoutArgs, FindFontId, FindTextStyle, TextBlockLayout, TextLayoutRanges, layoutTextBlock } from "../../TextAnnotationLayout";
import { Range2d } from "@itwin/core-geometry";
import { LineBreakRun, Paragraph, TextBlock, TextRun, TextStyleSettings } from "@itwin/core-common";

function computeTextRangeAsStringLength(args: ComputeRangesForTextLayoutArgs): TextLayoutRanges {
  const range = new Range2d(0, 0, args.chars.length, args.lineHeight);
  return { layout: range, justification: range };
}

function doLayout(textBlock: TextBlock, args?: {
  findTextStyle?: FindTextStyle,
  findFontId?: FindFontId,
  computeTextRange?: ComputeRangesForTextLayout,
}): TextBlockLayout {
  return layoutTextBlock({
    textBlock,
    iModel: {} as any,
    findTextStyle: args?.findTextStyle ?? (() => TextStyleSettings.defaults),
    findFontId: args?.findFontId ?? (() => 0),
    computeTextRange: args?.computeTextRange ?? computeTextRangeAsStringLength,
  });
}

describe.only("layoutTextBlock", () => {
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

  it("produces one line for a paragraph if the total width of the runs is less than the document width", () => {
    
  });

  it("produces one line per paragraph if document width <= 0", () => {
    const textBlock = TextBlock.create({ styleName: "" });
    for (let i = 0; i < 4; i++) {
      let layout = doLayout(textBlock);
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

  it("splits paragraphs into multiple lines if runs exceed the document width", () => {
  })

  it.skip("splits a single TextRun at word boundaries if it exceeds the document width", () => {
    // ###TODO word wrapping
  });
  
});

describe.only("produceTextAnnotationGeometry", () => {
  
});
