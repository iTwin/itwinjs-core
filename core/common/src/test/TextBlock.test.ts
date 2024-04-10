/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { FractionRunProps, Paragraph, ParagraphProps, RunProps, TextBlock, TextBlockProps, TextRun, TextRunProps, TextStyleSettingsProps } from "../core-common";

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

function makeParagraph(runs?: RunProps[], styleName = "", styleOverrides?: TextStyleSettingsProps): ParagraphProps {
  return {
    styleName,
    styleOverrides,
    runs,
  };
}

describe.only("TextBlockComponent", () => {
  describe("applyStyle", () => {
    let block: TextBlock;
    let paragraph: Paragraph;
    let run: TextRun;

    beforeEach(() => {
      block = TextBlock.create({ styleName: "block", styleOverrides: { widthFactor: 1234 }});
      paragraph = Paragraph.create({ styleName: "paragraph", styleOverrides: { lineHeight: 42 }});
      run = TextRun.create({ styleName: "run", styleOverrides: { fontName: "Consolas" } });
      paragraph.runs.push(run);
      block.paragraphs.push(paragraph);
    });

    it("clears overrides and propagates to subcomponents by default", () => {
      block.applyStyle("new");
      for (const component of [run, block, paragraph]) {
        expect(component.styleName).to.equal("new");
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
      paragraphs: [
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
    expect(tb.stringify()).to.equal("abc 1/π def   ghi j k l     / mno   ")
    const paragraphBreak = "P";
    const lineBreak = "L";
    const fractionSeparator = "F";
    expect(tb.stringify({ paragraphBreak, lineBreak, fractionSeparator })).to.equal("abcP1Fπ def   ghiLj k lPPPLPFPmnoPLL");
  });

  describe("clone", () => {
    it("creates an identical deep copy", () => {

    });
  });

  describe("create", () => {

  });

  describe("createEffectiveSettings", () => {

  });
});

describe("TextBlock", () => {
  describe("appendParagraph", () => {

  });

  describe("appendRun", () => {

  });
});
