/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ComputeRangesForTextLayout, ComputeRangesForTextLayoutArgs, FindFontId, FindTextStyle, TextBlockLayout, TextLayoutRanges, layoutTextBlock } from "../../TextAnnotationLayout";
import { Range2d } from "@itwin/core-geometry";
import { ColorDef, FontMap, FractionRun, GeometryStreamProps, LineBreakRun, Run, TextAnnotation, TextAnnotation2dProps, TextBlock, TextBlockGeometryPropsEntry, TextRun, TextStyleColor, TextStyleSettings } from "@itwin/core-common";
import { IModelDb } from "../../IModelDb";
import { TextAnnotation2d } from "../../TextAnnotationElement";
import { produceTextAnnotationGeometry } from "../../TextAnnotationGeometry";

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

function makeTextRun(content: string, styleName = ""): TextRun {
  return TextRun.create({ content, styleName });
}

describe("layoutTextBlock", () => {
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

  it("computes ranges based on custom line spacing and line height", () => {
    const lineSpacingFactor = 2;
    const lineHeight = 3;
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

    // We have 3 lines each `lineHeight` high, plus 2 line breaks in between each `lineHeight*lineSpacingFactor` high.
    expect(tb.range.low.x).to.equal(0);
    expect(tb.range.high.x).to.equal(6);
    expect(tb.range.high.y).to.equal(0);
    expect(tb.range.low.y).to.equal(-(lineHeight * 3 + (lineHeight * lineSpacingFactor) * 2));

    expect(tb.lines[0].offsetFromDocument.y).to.equal(-lineHeight);
    expect(tb.lines[1].offsetFromDocument.y).to.equal(tb.lines[0].offsetFromDocument.y - (lineHeight + lineHeight * lineSpacingFactor));
    expect(tb.lines[2].offsetFromDocument.y).to.equal(tb.lines[1].offsetFromDocument.y - (lineHeight + lineHeight * lineSpacingFactor));
    expect(tb.lines.every((line) => line.offsetFromDocument.x === 0)).to.be.true;
  });

  it("splits paragraphs into multiple lines if runs exceed the document width", () => {
    const textBlock = TextBlock.create({ styleName: "" });
    textBlock.width = 6;
    textBlock.appendRun(makeTextRun("ab"));
    expect(doLayout(textBlock).lines.length).to.equal(1);
    textBlock.appendRun(makeTextRun("cd"));
    expect(doLayout(textBlock).lines.length).to.equal(1);

    textBlock.appendRun(makeTextRun("ef"));
    expect(doLayout(textBlock).lines.length).to.equal(2);
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
  })

  function expectLines(input: string, width: number, expectedLines: string[]): TextBlockLayout {
    const textBlock = TextBlock.create({ styleName: "" });
    textBlock.width = width;
    const run = makeTextRun(input);
    textBlock.appendRun(run);

    const layout = doLayout(textBlock);
    expect(layout.lines.every((line) => line.runs.length === 1)).to.be.true;
    expect(layout.lines.every((line) => line.runs[0].source === run)).to.be.true;
    
    const actual = layout.lines.map((line) => line.runs.map((runLayout) => (runLayout.source as TextRun).content.substring(runLayout.charOffset, runLayout.charOffset + runLayout.numChars)).join(""));
    expect(actual).to.deep.equal(expectedLines);

    return layout;
  }

  it("splits a single TextRun at word boundaries if it exceeds the document width", () => {
    expectLines("a bc def ghij klmno pqrstu vwxyz", 5, [
      "a bc ",
      "def ",
      "ghij ",
      "klmno",
      " ",
      "pqrstu",
      " ",
      "vwxyz",
    ]);

    const fox = "The quick brown fox jumped over the lazy dog";
    expectLines(fox, 50, [fox]);
    expectLines(fox, 40, [
      //        1         2         3         4
      //234567890123456789012345678901234567890
      "The quick brown fox jumped over the lazy",
      " dog",
    ]);
    expectLines(fox, 30, [
      //        1         2         3
      //23456789012345678901234567890
      "The quick brown fox jumped ",
      "over the lazy dog",
    ]);
    expectLines(fox, 20, [
      //        1         2
      //2345678901234567890
      "The quick brown fox ",
      "jumped over the lazy",
      " dog",
    ]);
    expectLines(fox, 10, [
      //        1
      //234567890
      "The quick ",
      "brown fox ",
      "jumped ",
      "over the ",
      "lazy dog",
    ]);
  });
  
  it("considers consecutive whitespace a single 'word'", () => {
    expectLines("a b  c   d    e     f      ", 3, [
      "a b",
      "  c",
      "   ",
      "d",
      "    ",
      "e",
      "     ",
      "f",
      "      ",
    ]);
  });

  it("performs word-wrapping on Japanese text", () => {
    // "I am a cat. The name is Tanuki."
    expectLines("吾輩は猫である。名前はたぬき。", 1, ["吾輩", "は", "猫", "で", "ある", "。", "名前", "は", "たぬき", "。"]);
  });

  it("performs word-wrapping with punctuation", () => {
    expectLines("1.24 56.7 8,910", 1, ["1.24", " ", "56.7", " ", "8,910"]);

    // NOTE: Chrome splits a.bc and de.f on the periods. Safari and electron do not.
    // Since text layout is done in the backend, we're going to assume electron is right, and if not, that it's their responsibility to fix it.
    expectLines("a.bc de.f g,hij", 1, ["a.bc", " ", "de.f", " ", "g", ",", "hij"]);

    expectLines("Let's see...can you (or anyone) predict?!", 1, [
      "Let's", " ",
      "see",
      ".", ".", ".",
      "can", " ",
      "you", " ",
      "(", "or", " ", "anyone", ")", " ",
      "predict", "?", "!",
    ])
  });

  it("performs word-wrapping and line-splitting with multiple runs", () => {
    const textBlock = TextBlock.create({ styleName: "" });
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
      //234567890123456789012345678901234567890
      "The quick brown fox jumped over the lazy",
      " dog",
    ]);
    test(30, [
      //        1         2         3
      //23456789012345678901234567890
      "The quick brown fox jumped ",
      "over the lazy dog",
    ]);
    test(20, [
      //        1         2
      //2345678901234567890
      "The quick brown fox ",
      "jumped over the lazy",
      " dog",
    ]);
    test(10, [
      //        1
      //234567890
      "The quick ",
      "brown fox ",
      "jumped ",
      "over the ",
      "lazy dog",
    ]);
  });
});

function mockIModel(): IModelDb {
  const iModel: Pick<IModelDb, "fontMap" | "computeRangesForText" | "forEachMetaData"> = {
    fontMap: new FontMap(),
    computeRangesForText: () => { return { layout: new Range2d(0, 0, 1, 1), justification: new Range2d(0, 0, 1, 1) } },
    forEachMetaData: () => undefined,
  };

  return iModel as IModelDb;
}

describe("produceTextAnnotationGeometry", () => {
  type Color = ColorDef | "subcategory";
  
  function makeText(color?: Color): TextRun {
    const styleOverrides = undefined !== color ? { color: color instanceof ColorDef ? color.toJSON() : color } : undefined;
    return TextRun.create({ styleName: "", styleOverrides, content: "text" });
  }

  function makeFraction(color?: Color): FractionRun {
    const styleOverrides = undefined !== color ? { color: color instanceof ColorDef ? color.toJSON() : color } : undefined;
    return FractionRun.create({ numerator: "num", denominator: "denom", styleName: "", styleOverrides });
  }

  function makeBreak(color?: Color): LineBreakRun {
    const styleOverrides = undefined !== color ? { color: color instanceof ColorDef ? color.toJSON() : color } : undefined;
    return LineBreakRun.create({ styleName: "", styleOverrides });
  }

  function makeTextBlock(runs: Run[]): TextBlock {
    const block = TextBlock.create({ styleName: "" });
    for (const run of runs) {
      block.appendRun(run);
    }

    return block;
  }

  function makeGeometry(runs: Run[]): TextBlockGeometryPropsEntry[] {
    const block = makeTextBlock(runs);
    const annotation = TextAnnotation.fromJSON({ textBlock: block.toJSON() });
    return produceTextAnnotationGeometry({ iModel: mockIModel(), annotation }).entries;
  }

  it("produces an empty array for an empty text block", () => {
    expect(makeGeometry([])).to.deep.equal([]);
  });

  it("produces an empty array for a block consisting only of line breaks", () => {
    expect(makeGeometry([makeBreak(), makeBreak(), makeBreak()])).to.deep.equal([]);
  });
  
  it("produces one appearance entry if all runs use subcategory color", () => {
    const geom = makeGeometry([makeText(), makeFraction(), makeText("subcategory"), makeFraction("subcategory")]);
    console.log(JSON.stringify(geom));
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
});

describe("TextAnnotation element", () => {
  function makeElement(props?: Partial<TextAnnotation2dProps>): TextAnnotation2d {
    return TextAnnotation2d.fromJSON({
      category: "0x12",
      model: "0x34",
      code: {
        spec: "0x56",
        scope: "0x78",
      },
      classFullName: TextAnnotation2d.classFullName,
      ...props,
    }, mockIModel());
  }

  describe("getAnnotation", () => {
    it("returns undefined if not present in JSON properties", () => {
      expect(makeElement().getAnnotation()).to.be.undefined;
    });

    it("extracts from JSON properties", () => {
      const elem = makeElement({
        jsonProperties: {
          annotation: {
            textBlock: TextBlock.create({ styleName: "block" }).toJSON(),
          }
        }
      });

      const anno = elem.getAnnotation()!;
      expect(anno).not.to.be.undefined;
      expect(anno.textBlock.isEmpty).to.be.true;
      expect(anno.textBlock.styleName).to.equal("block");
    });

    it("produces a new object each time it is called", () => {
      const elem = makeElement({
        jsonProperties: {
          annotation: {
            textBlock: TextBlock.create({ styleName: "block" }).toJSON(),
          }
        }
      });
      
      const anno1 = elem.getAnnotation()!;
      const anno2 = elem.getAnnotation()!;
      expect(anno1).not.to.equal(anno2);
      expect(anno1.textBlock.equals(anno2.textBlock)).to.be.true;
    });
  });

  describe("setAnnotation", () => {
    it("updates JSON properties and recomputes geometry stream", () => {
      const elem = makeElement();
      expect(elem.geom).to.be.undefined;

      const annotation = { textBlock: TextBlock.create({ styleName: "block" }).toJSON() };
      elem.setAnnotation(TextAnnotation.fromJSON(annotation));

      expect(elem.geom).not.to.be.undefined;
      expect(elem.jsonProperties.annotation).to.deep.equal(annotation);
      expect(elem.jsonProperties.annotation).not.to.equal(annotation);
    });

    it("uses default subcategory by default", () => {
      const elem = makeElement();
      elem.setAnnotation(TextAnnotation.fromJSON({ textBlock: { styleName: "block" } }));
      expect(elem.geom!.length).to.equal(1);
      expect(elem.geom![0].appearance!.subCategory).to.equal("0x13");
    });

    it("uses specific subcategory if provided", () => {
      const elem = makeElement();
      elem.setAnnotation(TextAnnotation.fromJSON({ textBlock: { styleName: "block" } }), "0x1234");
      expect(elem.geom!.length).to.equal(1);
      expect(elem.geom![0].appearance!.subCategory).to.equal("0x1234");
    });
  });
});
