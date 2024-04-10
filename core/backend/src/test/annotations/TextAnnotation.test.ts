/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ComputeRangesForTextLayoutArgs, TextLayoutRanges, layoutTextBlock } from "../../TextAnnotationLayout";
import { Range2d } from "@itwin/core-geometry";
import { TextBlock, TextRun, TextStyleSettings } from "@itwin/core-common";

function computeTextRangeAsStringLength(args: ComputeRangesForTextLayoutArgs): TextLayoutRanges {
  const range = new Range2d(0, 0, args.chars.length, args.lineHeight);
  return { layout: range, justification: range };
}

describe.only("layoutTextBlock", () => {
  it("resolves TextStyleSettings from combination of TextBlock and Run", () => {
    const textBlock = TextBlock.create({ styleName: "block", styleOverrides: { widthFactor: 34, color: 0x00ff00 }});
    const run0 = TextRun.create({ content: "run0", styleName: "run", styleOverrides: { lineHeight: 56, color: 0xff0000 }});
    const run1 = TextRun.create({ content: "run1", styleName: "run", styleOverrides: { widthFactor: 78, fontName: "run1" }});
    textBlock.appendRun(run0);
    textBlock.appendRun(run1);

    const tb = layoutTextBlock({
      textBlock,
      iModel: { } as any,
      computeTextRange: computeTextRangeAsStringLength,
      findTextStyle: (name: string) => TextStyleSettings.fromJSON(name === "block" ? { lineSpacingFactor: 12, fontName: "block" } : { lineSpacingFactor: 99, fontName: "run" }),
      findFontId: () => 0,
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
    
  });

  it("splits paragraphs into multiple lines if runs exceed the document width", () => {
    
  })

  it.skip("splits a single TextRun at word boundaries if it exceeds the document width", () => {
    // ###TODO word wrapping
  });
  
});

describe.only("produceTextAnnotationGeometry", () => {
  
});
