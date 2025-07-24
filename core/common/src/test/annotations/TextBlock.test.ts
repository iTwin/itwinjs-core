/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { beforeEach, describe, expect, it } from "vitest";
import { FractionRunProps, Paragraph, ParagraphProps, RunProps, TextBlock, TextBlockProps, TextRun, TextRunProps, TextStyleSettingsProps } from "../../core-common";

function makeTextRun(content?: string, styleName = "", styleOverrides?: TextStyleSettingsProps): TextRunProps {
  return {
    type: "text",
    content,
    styleName,
    styleOverrides,
  };
}

function makeFractionRun(numerator?: string, denominator?: string, styleName = "", styleOverrides?: TextStyleSettingsProps): FractionRunProps {
  return {
    type: "fraction",
    numerator,
    denominator,
    styleName,
    styleOverrides,
  };
}

function makeParagraph(children?: RunProps[], styleName = "", styleOverrides?: TextStyleSettingsProps): ParagraphProps {
  return {
    styleName,
    styleOverrides,
    children,
  };
}

describe("TextBlockComponent", () => {
  describe("applyStyle", () => {
    let block: TextBlock;
    let paragraph: Paragraph;
    let run: TextRun;

    beforeEach(() => {
      block = TextBlock.create({ styleName: "block", styleOverrides: { widthFactor: 1234 }});
      paragraph = block.appendParagraph({ styleName: "paragraph", styleOverrides: { lineHeight: 42 } });
      paragraph.appendChild(TextRun.create({ styleName: "run", styleOverrides: { fontName: "Consolas" } }));
      run = paragraph.children![0] as TextRun;
    });

    it("clears overrides and propagates to sub components by default", () => {
      block.applyStyle("new");
      for (const component of [run, block, paragraph]) {
        expect(component.styleName, `Style name for ${component.constructor.name}`).to.equal("new");
        expect(component.styleOverrides).to.deep.equal({});
      }
    });

    it("preserves overrides if specified", () => {
      block.applyStyle("new", { preserveOverrides: true });

      for (const component of [run, block, paragraph]) {
        expect(component.styleName).to.equal("new");
      }

      expect(block.styleOverrides).to.deep.equal({ widthFactor: 1234 });
      expect(paragraph.styleOverrides).to.deep.equal({ lineHeight: 42 });
      expect(run.styleOverrides).to.deep.equal({ fontName: "Consolas" });
    });

    it("prevents propagation if specified", () => {
      block.applyStyle("new", { preventPropagation: true });
      expect(block.styleName).to.equal("new");
      expect(block.styleOverrides).to.deep.equal({});

      expect(paragraph.styleName).to.equal("paragraph");
      expect(paragraph.styleOverrides).to.deep.equal({ lineHeight: 42 });

      expect(run.styleName).to.equal("run");
      expect(run.styleOverrides).to.deep.equal({ fontName: "Consolas" });
    });
  });

  it("stringifies", () => {
    const props: TextBlockProps = {
      styleName: "",
      children: [
        makeParagraph([
          makeTextRun("abc"),
        ]),
        makeParagraph([
          makeFractionRun("1", "π"),
          makeTextRun(" def   ghi"),
          { type: "linebreak", styleName: "" },
          makeTextRun("j k l"),
        ]),
        makeParagraph(),
        makeParagraph([makeTextRun()]),
        makeParagraph([{ type: "linebreak", styleName: "" }]),
        makeParagraph([makeFractionRun()]),
        makeParagraph([makeTextRun("mno")]),
        makeParagraph([{ type: "linebreak", styleName: "" }, { type: "linebreak", styleName: "" }]),
      ],
    };

    const tb = TextBlock.create(props);
    expect(tb.stringify()).to.equal("abc 1/π def   ghi j k l     / mno   ");
    const paragraphBreak = "P";
    const lineBreak = "L";
    const fractionSeparator = "F";
    expect(tb.stringify({ paragraphBreak, lineBreak, fractionSeparator })).to.equal("abcP1Fπ def   ghiLj k lPPPLPFPmnoPLL");
  });

  it("adds parents to runs and paragraphs", () => {
    const props: TextBlockProps = {
      styleName: "",
      children: [
        makeParagraph([
          makeTextRun("abc"),
        ]),
        makeParagraph([
          makeFractionRun("1", "π"),
          makeTextRun(" def   ghi"),
          { type: "linebreak", styleName: "" },
          { type: "tab", styleName: "" }
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
    it("uses the TextBlock's style with no overrides if no paragraphs exist", () => {
      const tb = TextBlock.create({ styleName: "block", styleOverrides: { lineHeight: 42 } });
      const p = tb.appendParagraph();
      expect(p.styleName).to.equal("block");
      expect(p.styleOverrides).to.deep.equal({});
    });

    it("uses the style and overrides of the last paragraph if one exists", () => {
      const tb = TextBlock.create({ styleName: "block", styleOverrides: { lineHeight: 42 } });
      const p1 = tb.appendParagraph();
      expect(p1.styleName).to.equal("block");
      expect(p1.styleOverrides).to.deep.equal({});

      p1.styleName = "paragraph";
      p1.styleOverrides = { widthFactor: 1234 };
      const p2 = tb.appendParagraph();
      expect(p2.styleName).to.equal(p1.styleName);
      expect(p2.styleOverrides).to.deep.equal(p1.styleOverrides);
    });
  });

  describe("appendRun", () => {
    it("appends a paragraph IFF the text block is empty", () => {
      const tb = TextBlock.create({ styleName: "block" });
      expect(tb.children?.length).to.equal(0);

      tb.appendRun(TextRun.create({ styleName: "run1" }));
      expect(tb.children?.length).to.equal(1);
      expect(tb.children![0].children?.length).to.equal(1);

      tb.appendRun(TextRun.create({ styleName: "r2" }));
      expect(tb.children?.length).to.equal(1);
      expect(tb.children![0].children?.length).to.equal(2);
    });
  });
});

// cspell:ignore Consolas PPPLPF Pmno