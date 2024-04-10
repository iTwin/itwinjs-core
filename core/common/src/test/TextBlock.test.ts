/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { FractionRunProps, ParagraphProps, RunProps, TextBlock, TextBlockProps, TextRunProps, TextStyleSettingsProps } from "../core-common";

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
    it("clears overrides and propagates to subcomponents by default", () => {

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
