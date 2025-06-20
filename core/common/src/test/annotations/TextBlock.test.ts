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


function getStyleIds(block: TextBlock) {
  return {
    block: block.styleId,
    paragraph: block.paragraphs[0]?.styleId,
    run: block.paragraphs[0]?.runs[0]?.styleId,
 };
}

function getOverrides(block: TextBlock) {
  return {
    block: block.styleOverrides,
    paragraph: block.paragraphs[0]?.styleOverrides,
    run: block.paragraphs[0]?.runs[0]?.styleOverrides,
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

    it("clears both styles and overrides by default", () => {
      block.applyStyle("0x99");

      const ids = getStyleIds(block);
      expect(ids.block).to.equal("0x99");
      expect(ids.paragraph).to.equal("");
      expect(ids.run).to.equal("");

      const overrides = getOverrides(block);
      expect(overrides.block).to.deep.equal({});
      expect(overrides.paragraph).to.deep.equal({});
      expect(overrides.run).to.deep.equal({});
    });

    it("preserves overrides but clears styles", () => {
      block.applyStyle("0x99", { preserveOverrides: true });

      const ids = getStyleIds(block);
      expect(ids.block).to.equal("0x99");
      expect(ids.paragraph).to.equal("");
      expect(ids.run).to.equal("");

      const overrides = getOverrides(block);
      expect(overrides.block).to.deep.equal({ widthFactor: 1234 });
      expect(overrides.paragraph).to.deep.equal({ lineHeight: 42 });
      expect(overrides.run).to.deep.equal({ fontName: "Consolas" });
    });

    it("preserves styles but clears overrides", () => {
      block.applyStyle("0x99", { preserveChildrenStyles: true });

      const ids = getStyleIds(block);
      expect(ids.block).to.equal("0x99");
      expect(ids.paragraph).to.equal("0x43");
      expect(ids.run).to.equal("0x44");

      const overrides = getOverrides(block);
      expect(overrides.block).to.deep.equal({});
      expect(overrides.paragraph).to.deep.equal({});
      expect(overrides.run).to.deep.equal({});
    });

    it("preserves both styles and overrides", () => {
      block.applyStyle("0x99", { preserveOverrides: true, preserveChildrenStyles: true });

      const ids = getStyleIds(block);
      expect(ids.block).to.equal("0x99");
      expect(ids.paragraph).to.equal("0x43");
      expect(ids.run).to.equal("0x44");

      const overrides = getOverrides(block);
      expect(overrides.block).to.deep.equal({ widthFactor: 1234 });
      expect(overrides.paragraph).to.deep.equal({ lineHeight: 42 });
      expect(overrides.run).to.deep.equal({ fontName: "Consolas" });
    });

    it("handles empty text block", () => {
      const empty = TextBlock.createEmpty();
      expect(() => empty.applyStyle("0x01")).not.to.throw();
      expect(empty.styleId).to.equal("0x01");
    });

    it("handles paragraph with no runs", () => {
      const tb = TextBlock.create({ styleId: "0x01", paragraphs: [Paragraph.create({ styleId: "0x02" })] });
      expect(() => tb.applyStyle("0x03")).not.to.throw();
      expect(tb.styleId).to.equal("0x03");
      expect(tb.paragraphs[0].styleId).to.equal("");
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
    it("creates a paragraph with no styleId or overrides by default", () => {
      const tb = TextBlock.create({ styleId: "0x42", styleOverrides: { lineHeight: 42 } });
      const p = tb.appendParagraph();
      expect(p.styleId).to.equal("");
      expect(p.styleOverrides).to.deep.equal({});

      const p2 = tb.appendParagraph();
      expect(p2.styleId).to.equal("");
      expect(p2.styleOverrides).to.deep.equal({});

      expect(tb.paragraphs.length).to.equal(2);
    });

    it("uses the style and overrides of the last paragraph if one exists and seedFromLast is true", () => {
      const tb = TextBlock.create({ styleId: "0x42", styleOverrides: { lineHeight: 42 } });
      const p1 = Paragraph.create({ styleId: "0x43", styleOverrides: { isBold: true } });
      tb.paragraphs.push(p1);

      const p2 = tb.appendParagraph(true);
      expect(p2.styleId).to.equal(p1.styleId);
      expect(p2.styleOverrides).to.deep.equal(p1.styleOverrides);
    });

    it("creates a paragraph with no styleId or overrides if none exist even if seedFromLast is true", () => {
      const tb = TextBlock.create({ styleId: "0x42", styleOverrides: { lineHeight: 42 } });
      const p1 = tb.appendParagraph(true);
      expect(p1.styleId).to.equal("");
      expect(p1.styleOverrides).to.deep.equal({});
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
