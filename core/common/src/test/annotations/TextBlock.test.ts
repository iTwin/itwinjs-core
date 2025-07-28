/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { beforeEach, describe, expect, it } from "vitest";
import { FieldRun, FractionRunProps, Paragraph, ParagraphProps, RunProps, TextBlock, TextBlockProps, TextRun, TextRunProps, TextStyleSettingsProps } from "../../core-common";

function makeTextRun(content?: string, styleOverrides?: TextStyleSettingsProps): TextRunProps {
  return {
    type: "text",
    content,
    styleOverrides,
  };
}

function makeFractionRun(numerator?: string, denominator?: string, styleOverrides?: TextStyleSettingsProps): FractionRunProps {
  return {
    type: "fraction",
    numerator,
    denominator,
    styleOverrides,
  };
}

function makeParagraph(children?: RunProps[], styleOverrides?: TextStyleSettingsProps): ParagraphProps {
  return {
    styleOverrides,
    children,
  };
}

function getOverrides(block: TextBlock) {
  return {
    block: block.styleOverrides,
    paragraph: block.children?.[0]?.styleOverrides,
    run: block.children?.[0]?.children?.[0]?.styleOverrides,
  };
}

describe("TextBlockComponent", () => {
  describe("setStyle", () => {
    let block: TextBlock;
    let paragraph: Paragraph;

    beforeEach(() => {
      block = TextBlock.create({ styleId: "0x42", styleOverrides: { widthFactor: 1234 }});
      paragraph = block.appendParagraph({ styleOverrides: { lineHeight: 42 } });
      paragraph.appendChild(TextRun.create({ styleOverrides: { fontName: "Consolas" } }));
    });

    it("sets style but does not clear overrides by default", () => {
      block.styleId = "0x99";
      expect(block.styleId).to.equal("0x99");

      const overrides = getOverrides(block);
      expect(overrides.block).to.deep.equal({ widthFactor: 1234 });
      expect(overrides.paragraph).to.deep.equal({ lineHeight: 42 });
      expect(overrides.run).to.deep.equal({ fontName: "Consolas" });
    });

    it("clears children's overrides by default when clearing block overrides", () => {
      block.styleId = "0x99";

      block.clearStyleOverrides();
      const overrides = getOverrides(block);
      expect(overrides.block).to.deep.equal({});
      expect(overrides.paragraph).to.deep.equal({});
      expect(overrides.run).to.deep.equal({});
    });

    it("clears children's overrides by default when clearing paragraph overrides", () => {
      block.styleId = "0x99";

      block.children?.[0].clearStyleOverrides();
      const overrides = getOverrides(block);
      expect(overrides.block).to.deep.equal({ widthFactor: 1234 });
      expect(overrides.paragraph).to.deep.equal({});
      expect(overrides.run).to.deep.equal({});
    });

    it("does not clear children's overrides when clearing block overrides if preserveChildrenStyles is true", () => {
      block.styleId = "0x99";

      block.clearStyleOverrides({ preserveChildrenOverrides: true });
      const overrides = getOverrides(block);
      expect(overrides.block).to.deep.equal({});
      expect(overrides.paragraph).to.deep.equal({ lineHeight: 42 });
      expect(overrides.run).to.deep.equal({ fontName: "Consolas" });
    });

    it("does not clear children's overrides when clearing paragraph overrides if preserveChildrenStyles is true", () => {
      block.styleId = "0x99";

      block.children?.[0].clearStyleOverrides({ preserveChildrenOverrides: true });
      const overrides = getOverrides(block);
      expect(overrides.block).to.deep.equal({ widthFactor: 1234 });
      expect(overrides.paragraph).to.deep.equal({});
      expect(overrides.run).to.deep.equal({ fontName: "Consolas" });
    });

    it("handles empty text block", () => {
      const empty = TextBlock.createEmpty();
      expect(empty.styleId).to.equal("");
      expect(empty.styleOverrides).to.deep.equal({});
      expect(() => empty.clearStyleOverrides()).not.to.throw();
      expect(() => empty.styleId = "0x01").not.to.throw();
      expect(empty.styleId).to.equal("0x01");
    });

    it("creates a deep copy of the style overrides", () => {
      const originalOverrides: TextStyleSettingsProps = { widthFactor: 1234, lineHeight: 42, fontName: "Consolas", frame: { shape: "rectangle" }};
      block.styleOverrides = originalOverrides;

      originalOverrides.frame!.shape = "circle";

      expect(block.styleOverrides).to.deep.equal({ widthFactor: 1234, lineHeight: 42, fontName: "Consolas", frame: { shape: "rectangle" } });
      expect(originalOverrides.frame!.shape).to.equal("circle");
    });
  });

  it("stringifies", () => {
    const props: TextBlockProps = {
      styleId: "",
      children: [
        makeParagraph([
          makeTextRun("abc"),
        ]),
        makeParagraph([
          makeFractionRun("1", "π"),
          makeTextRun(" def   ghi"),
          { type: "linebreak" },
          makeTextRun("j k l"),
        ]),
        makeParagraph(),
        makeParagraph([makeTextRun()]),
        makeParagraph([{ type: "linebreak" }]),
        makeParagraph([makeFractionRun()]),
        makeParagraph([makeTextRun("mno")]),
        makeParagraph([{ type: "linebreak" }, { type: "linebreak" }]),
      ],
    };

    const tb = TextBlock.create(props);
    expect(tb.stringify()).to.equal("abc 1/π def   ghi j k l     / mno   ");
    const paragraphBreak = "P";
    const lineBreak = "L";
    const fractionSeparator = "F";
    expect(tb.stringify({ paragraphBreak, lineBreak, fractionSeparator })).to.equal("abcP1Fπ def   ghiLj k lPPPLPFPmnoPLL");
  });

  it("adds parents to runs and children", () => {
    const props: TextBlockProps = {
      styleId: "0x42",
      children: [
        makeParagraph([
          makeTextRun("abc"),
        ]),
        makeParagraph([
          makeFractionRun("1", "π"),
          makeTextRun(" def   ghi"),
          { type: "linebreak" },
          { type: "tab" }
        ]),
      ],
    };

    const tb = TextBlock.create(props);

    expect(tb.root).to.equal(tb);
    expect(tb.children?.length).to.equal(2);

    const p0 = tb.children![0] as Paragraph;
    const p1 = tb.children![1] as Paragraph;

    expect(p0.parent).to.equal(tb);
    expect(p0.root).to.equal(tb);
    expect(p0.children).toBeDefined;
    expect(p1.parent).to.equal(tb);
    expect(p1.root).to.equal(tb);
    expect(p1.children).toBeDefined;

    const p0Children = p0.children!;
    expect(p0Children.length).to.equal(1);
    p0Children.forEach((run, index) => {
      expect(run.previousSibling).to.equal(p0Children[index - 1]);
      expect(run.nextSibling).to.equal(p0Children[index + 1]);
      expect(run.parent).to.equal(p0);
      expect(run.root).to.equal(tb);
    });

    const p1Children = p1.children!;
    expect(p1Children.length).to.equal(4);
    p1Children.forEach((run, index) => {
      expect(run.previousSibling).to.equal(p1Children[index - 1]);
      expect(run.nextSibling).to.equal(p1Children[index + 1]);
      expect(run.parent).to.equal(p1);
      expect(run.root).to.equal(tb);
    });
  });
});

describe("TextBlock", () => {
  describe("appendParagraph", () => {
    it("creates a paragraph with no overrides by default", () => {
      const tb = TextBlock.create({ styleId: "0x42", styleOverrides: { lineHeight: 42 } });
      const p = tb.appendParagraph();
      expect(p.styleOverrides).to.deep.equal({});

      const p2 = tb.appendParagraph();
      expect(p2.styleOverrides).to.deep.equal({});

      expect(tb.children?.length).to.equal(2);
    });

    it("uses the overrides of the last paragraph if one exists and seedFromLast is true", () => {
      const tb = TextBlock.create({ styleId: "0x42", styleOverrides: { lineHeight: 42 } });
      const p1 = Paragraph.create({ styleOverrides: { isBold: true } });
      tb.appendParagraph(p1);

      const p2 = tb.appendParagraph(undefined, true);
      expect(p2.styleOverrides).to.deep.equal(p1.styleOverrides);
    });

    it("creates a paragraph with no overrides if none exist even if seedFromLast is true", () => {
      const tb = TextBlock.create({ styleId: "0x42", styleOverrides: { lineHeight: 42 } });
      const p1 = tb.appendParagraph(undefined, true);
      expect(p1.styleOverrides).to.deep.equal({});
    });
  });

  describe("appendRun", () => {
    it("appends a paragraph IFF the text block is empty", () => {
      const tb = TextBlock.create({ styleId: "0x42" });
      expect(tb.children?.length).to.equal(0);

      tb.appendRun(TextRun.create());
      expect(tb.children?.length).to.equal(1);
      expect(tb.children![0].children?.length).to.equal(2);
    });
  });
});

// cspell:ignore Consolas PPPLPF Pmno