/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { beforeEach, describe, expect, it } from "vitest";
import { FieldRun, FractionRunProps, Paragraph, ParagraphProps, RunProps, TextBlock, TextBlockProps, TextRun, TextRunProps, TextStyleSettingsProps } from "../../core-common";

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

describe("TextBlockComponent", () => {
  describe("applyStyle", () => {
    let block: TextBlock;
    let paragraph: Paragraph;
    let run: TextRun;

    beforeEach(() => {
      block = TextBlock.create({ styleName: "block", styleOverrides: { widthFactor: 1234 } });
      paragraph = Paragraph.create({ styleName: "paragraph", styleOverrides: { lineHeight: 42 } });
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
      expect(tb.paragraphs.length).to.equal(0);

      tb.appendRun(TextRun.create({ styleName: "run1" }));
      expect(tb.paragraphs.length).to.equal(1);
      expect(tb.paragraphs[0].runs.length).to.equal(1);

      tb.appendRun(TextRun.create({ styleName: "r2" }));
      expect(tb.paragraphs.length).to.equal(1);
      expect(tb.paragraphs[0].runs.length).to.equal(2);
    });
  });
});

describe("FieldRun", () => {
  describe("create", () => {
    it("initializes fields", () => {
      const fieldRun = FieldRun.create({
        styleName: "fieldStyle",
        propertyHost: { elementId: "0x123" },
        propertyPath: [{ propertyName: "someProperty" }],
        cachedContent: "cachedValue",
      });

      expect(fieldRun.styleName).to.equal("fieldStyle");
      expect(fieldRun.propertyHost.elementId).to.equal("0x123");
      expect(fieldRun.propertyPath).to.deep.equal([{ propertyName: "someProperty" }]);
      expect(fieldRun.cachedContent).to.equal("cachedValue");
    });

    it("initializes cachedContent to invalid content indicator if undefined", () => {
      expect(FieldRun.create({
        styleName: "fieldStyle",
        propertyHost: { elementId: "0x123" },
        propertyPath: [{ propertyName: "someProperty" }],
      }).cachedContent).toEqual(FieldRun.invalidContentIndicator);
    });

    it("deeply clones accessor", () => {
      const propertyPath = [
        { propertyName: "array1", arrayIndex: 0 },
        { propertyName: "array2", arrayIndex: -1 },
      ];

      const fieldRun = FieldRun.create({
        styleName: "fieldStyle",
        propertyHost: { elementId: "0x123" },
        propertyPath,
      });

      // Modify the original propertyPath to ensure the FieldRun's copy is unaffected
      propertyPath[0].propertyName = "modifiedArray1";

      expect(fieldRun.propertyPath).to.deep.equal([
        { propertyName: "array1", arrayIndex: 0 },
        { propertyName: "array2", arrayIndex: -1 },
      ]);
    });

    it("deeply clones formatter", () => {
      const formatter = { formatType: "currency", precision: 2, options: { locale: "en-US", style: "decimal" } };

      const fieldRun = FieldRun.create({
        styleName: "fieldStyle",
        propertyHost: { elementId: "0x123" },
        propertyPath: [{ propertyName: "someProperty" }],
        formatter,
      });

      // Modify the original formatter to ensure the FieldRun's copy is unaffected
      formatter.formatType = "percentage";
      formatter.precision = 3;
      formatter.options.locale = "fr-FR";
      formatter.options.style = "percent";

      expect(fieldRun.formatter).to.deep.equal({ formatType: "currency", precision: 2, options: { locale: "en-US", style: "decimal" } });
    });
  });

  describe("toJSON", () => {
    it("serializes and deserializes FieldRun correctly", () => {
      const fieldRun = FieldRun.create({
        styleName: "fieldStyle",
        propertyHost: { elementId: "0x123" },
        propertyPath: [{ propertyName: "someProperty" }],
        cachedContent: "cachedValue",
      });

      const json = fieldRun.toJSON();
      const deserialized = FieldRun.create(json);

      expect(deserialized.equals(fieldRun)).to.be.true;
    });

    it("omits cachedContent if it is equal to invalid content indicator", () => {
      const fieldRun = FieldRun.create({
        styleName: "fieldStyle",
        propertyHost: { elementId: "0x123" },
        propertyPath: [{ propertyName: "someProperty" }],
        cachedContent: FieldRun.invalidContentIndicator,
      });

      expect(fieldRun.toJSON().cachedContent).to.be.undefined;
    });
  });

  describe("stringify", () => {
    it("produces cached content", () => {
      const fieldRun = FieldRun.create({
        styleName: "fieldStyle",
        propertyHost: { elementId: "0x123" },
        propertyPath: [{ propertyName: "someProperty" }],
        cachedContent: "cachedValue",
      });

      expect(fieldRun.stringify()).to.equal("cachedValue");
    });
  });

  describe("equals", () => {
    it("compares FieldRuns for equality", () => {
      const baseProps = {
        styleName: "fieldStyle",
        propertyHost: { elementId: "0x123" },
        propertyPath: [{ propertyName: "someProperty" }],
        cachedContent: "cachedValue",
      };


      const combinations = [
        { formatter: { formatType: "currency" } },
        { propertyHost: { elementId: "0x456" } },
        { propertyPath: [{ propertyName: "otherProperty" }] },
        { propertyPath: [{ propertyName: "someProperty", arrayIndex: 0 }] },
        { propertyPath: [{ propertyName: "someProperty", arrayIndex: 1 }] },
        { propertyPath: [{ propertyName: "someProperty" }, { propertyName: "otherProperty" }] },
      ];

      const fieldRuns = combinations.map((combo) =>
        FieldRun.create({
          ...baseProps,
          ...combo,
        })
      );

      for (let i = 0; i < fieldRuns.length; i++) {
        const fieldRunA = fieldRuns[i];
        for (let j = 0; j < fieldRuns.length; j++) {
          const fieldRunB = fieldRuns[j];
          if (i === j) {
            expect(fieldRunA.equals(fieldRunB)).to.be.true;
          } else {
            expect(fieldRunA.equals(fieldRunB)).to.be.false;
          }
        }
      }
    });

    it("ignores cached content", () => {
      const field1 = FieldRun.create({
        styleName: "fieldStyle",
        propertyHost: { elementId: "0x123" },
        propertyPath: [{ propertyName: "someProperty" }],
        cachedContent: "1",
      });

      const field2 = FieldRun.create({
        styleName: "fieldStyle",
        propertyHost: { elementId: "0x123" },
        propertyPath: [{ propertyName: "someProperty" }],
        cachedContent: "2",
      });

      expect(field1.equals(field2)).to.be.true;
    });
  });
});

