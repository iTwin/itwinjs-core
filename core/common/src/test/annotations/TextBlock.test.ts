/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { beforeEach, describe, expect, it } from "vitest";
import { FractionRunProps, Paragraph, ParagraphProps, RunProps, TextBlock, TextBlockProps, TextRun, TextRunProps, TextStyleSettingsProps } from "../../core-common";

function makeTextRun(content?: string, styleId = "", styleOverrides?: TextStyleSettingsProps): TextRunProps {
  return {
    type: "text",
    content,
    styleId,
    styleOverrides,
  };
}

function makeFractionRun(numerator?: string, denominator?: string, styleId = "", styleOverrides?: TextStyleSettingsProps): FractionRunProps {
  return {
    type: "fraction",
    numerator,
    denominator,
    styleId,
    styleOverrides,
  };
}

function makeParagraph(runs?: RunProps[], styleId = "", styleOverrides?: TextStyleSettingsProps): ParagraphProps {
  return {
    styleId,
    styleOverrides,
    runs,
  };
}

describe("TextBlockComponent", () => {
  describe("applyStyle", () => {
    let block: TextBlock;
    let paragraph: Paragraph;
    let run: TextRun;

    beforeEach(() => {
      block = TextBlock.create({ styleId: "0x42", styleOverrides: { widthFactor: 1234 }});
      paragraph = Paragraph.create({ styleId: "0x43", styleOverrides: { lineHeight: 42 }});
      run = TextRun.create({ styleId: "0x44", styleOverrides: { fontName: "Consolas" } });
      paragraph.runs.push(run);
      block.paragraphs.push(paragraph);
    });

    it("clears overrides and propagates to subcomponents by default", () => {
      block.applyStyle("0x55");
      for (const component of [run, block, paragraph]) {
        expect(component.styleId).to.equal("0x55");
        expect(component.styleOverrides).to.deep.equal({});
      }
    });

    it("preserves overrides if specified", () => {
      block.applyStyle("0x55", { preserveOverrides: true });
      for (const component of [run, block, paragraph]) {
        expect(component.styleId).to.equal("0x55");
      }

      expect(block.styleOverrides).to.deep.equal({ widthFactor: 1234 });
      expect(paragraph.styleOverrides).to.deep.equal({ lineHeight: 42 });
      expect(run.styleOverrides).to.deep.equal({ fontName: "Consolas" });
    });

    it("prevents propagation if specified", () => {
      block.applyStyle("0x55", { preventPropagation: true });
      expect(block.styleId).to.equal("0x55");
      expect(block.styleOverrides).to.deep.equal({});

      expect(paragraph.styleId).to.equal("0x43");
      expect(paragraph.styleOverrides).to.deep.equal({ lineHeight: 42 });

      expect(run.styleId).to.equal("0x44");
      expect(run.styleOverrides).to.deep.equal({ fontName: "Consolas" });
    });
  });

  it("stringifies", () => {
    const props: TextBlockProps = {
      styleId: "",
      paragraphs: [
        makeParagraph([
          makeTextRun("abc"),
        ]),
        makeParagraph([
          makeFractionRun("1", "π"),
          makeTextRun(" def   ghi"),
          { type: "linebreak", styleId: "" },
          makeTextRun("j k l"),
        ]),
        makeParagraph(),
        makeParagraph([makeTextRun()]),
        makeParagraph([{ type: "linebreak", styleId: "" }]),
        makeParagraph([makeFractionRun()]),
        makeParagraph([makeTextRun("mno")]),
        makeParagraph([{ type: "linebreak", styleId: "" }, { type: "linebreak", styleId: "" }]),
      ],
    };

    const tb = TextBlock.create(props);
    expect(tb.stringify()).to.equal("abc 1/π def   ghi j k l     / mno   ");
    const paragraphBreak = "P";
    const lineBreak = "L";
    const fractionSeparator = "F";
    expect(tb.stringify({ paragraphBreak, lineBreak, fractionSeparator })).to.equal("abcP1Fπ def   ghiLj k lPPPLPFPmnoPLL");
  });
});

describe("TextBlock", () => {
  describe("appendParagraph", () => {
    it("uses the TextBlock's style with no overrides if no paragraphs exist", () => {
      const tb = TextBlock.create({ styleId: "0x42", styleOverrides: { lineHeight: 42 } });
      const p = tb.appendParagraph();
      expect(p.styleId).to.equal("0x42");
      expect(p.styleOverrides).to.deep.equal({});
    });

    it("uses the style and overrides of the last paragraph if one exists", () => {
      const tb = TextBlock.create({ styleId: "0x42", styleOverrides: { lineHeight: 42 } });
      const p1 = tb.appendParagraph();
      expect(p1.styleId).to.equal("0x42");
      expect(p1.styleOverrides).to.deep.equal({});

      p1.styleId = "0x43";
      p1.styleOverrides = { widthFactor: 1234 };
      const p2 = tb.appendParagraph();
      expect(p2.styleId).to.equal(p1.styleId);
      expect(p2.styleOverrides).to.deep.equal(p1.styleOverrides);
    });
  });

  describe("appendRun", () => {
    it("appends a paragraph IFF the text block is empty", () => {
      const tb = TextBlock.create({ styleId: "0x42" });
      expect(tb.paragraphs.length).to.equal(0);

      tb.appendRun(TextRun.create({ styleId: "0x44" }));
      expect(tb.paragraphs.length).to.equal(1);
      expect(tb.paragraphs[0].runs.length).to.equal(1);

      tb.appendRun(TextRun.create({ styleId: "0x45" }));
      expect(tb.paragraphs.length).to.equal(1);
      expect(tb.paragraphs[0].runs.length).to.equal(2);
    });
  });
});
