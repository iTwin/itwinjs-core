/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { beforeEach, describe, expect, it } from "vitest";
import { FieldRun, FractionRun, FractionRunProps, LineBreakRun, List, ListMarkerEnumerator, ListProps, Paragraph, ParagraphProps, RunProps, TabRun, TextBlock, TextBlockProps, TextRun, TextRunProps, TextStyleSettingsProps, traverseTextBlockComponent } from "../../core-common";

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

function makeParagraph(children?: (RunProps | ListProps)[], styleOverrides?: TextStyleSettingsProps): ParagraphProps {
  return {
    styleOverrides,
    children,
  };
}

function makeList(children?: ParagraphProps[], styleOverrides?: TextStyleSettingsProps): ListProps {
  return {
    type: "list",
    styleOverrides,
    children,
  };
}

function makeInnerList(children?: ParagraphProps[], styleOverrides?: TextStyleSettingsProps): ParagraphProps {
  return {
    children: [{
      type: "list",
      styleOverrides,
      children,
    }],
  };
}

function getOverrides(block: TextBlock) {
  const paragraph = block.children[0];
  const run = paragraph?.children[0];
  const list = paragraph.children[1] as List;
  const listItem = list?.children[0];
  const listRun = listItem?.children[0];

  return {
    block: block.styleOverrides,
    paragraph: paragraph?.styleOverrides,
    run: run?.styleOverrides,
    list: list?.styleOverrides,
    listItem: listItem?.styleOverrides,
    listRun: listRun?.styleOverrides,
  };
}

describe("TextBlockComponent", () => {
  describe("setStyle", () => {
    let block: TextBlock;

    beforeEach(() => {
      block = TextBlock.create({ styleOverrides: { widthFactor: 1234 }});
      const paragraph = block.appendParagraph({ styleOverrides: { textHeight: 42 } });
      paragraph.children.push(TextRun.create({ styleOverrides: { font: { name: "Consolas" }}}));

      const list = List.create({ styleOverrides: { listMarker: { enumerator: "*", terminator: "period", case: "lower" } } });
      paragraph.children.push(list);
      const listParagraph = Paragraph.create({ styleOverrides: { textHeight: 21 } });
      listParagraph.children.push(TextRun.create({ styleOverrides: { font: { name: "Verdana" } } }));
      list.children.push(listParagraph);
    });

    it("has overrides", () => {
      const overrides = getOverrides(block);
      expect(overrides.block).to.deep.equal({ widthFactor: 1234 });
      expect(overrides.paragraph).to.deep.equal({ textHeight: 42 });
      expect(overrides.run).to.deep.equal({ font: { name: "Consolas" } });

      expect(overrides.list).to.deep.equal({ listMarker: { enumerator: "*", terminator: "period", case: "lower" } });
      expect(overrides.listItem).to.deep.equal({ textHeight: 21 });
      expect(overrides.listRun).to.deep.equal({ font: { name: "Verdana" } });
    });

    it("clears children's overrides by default when clearing block overrides", () => {
      block.clearStyleOverrides();
      const overrides = getOverrides(block);
      expect(overrides.block).to.deep.equal({});
      expect(overrides.paragraph).to.deep.equal({});
      expect(overrides.run).to.deep.equal({});

      expect(overrides.list).to.deep.equal({});
      expect(overrides.listItem).to.deep.equal({});
      expect(overrides.listRun).to.deep.equal({});
    });

    it("clears children's overrides by default when clearing paragraph overrides", () => {
      block.children[0].clearStyleOverrides();
      const overrides = getOverrides(block);
      expect(overrides.block).to.deep.equal({ widthFactor: 1234 });
      expect(overrides.paragraph).to.deep.equal({});
      expect(overrides.run).to.deep.equal({});

      expect(overrides.list).to.deep.equal({});
      expect(overrides.listItem).to.deep.equal({});
      expect(overrides.listRun).to.deep.equal({});
    });

    it("clears children's overrides by default when clearing list overrides", () => {
      block.children[0].children[1].clearStyleOverrides();
      const overrides = getOverrides(block);
      expect(overrides.block).to.deep.equal({ widthFactor: 1234 });
      expect(overrides.paragraph).to.deep.equal({ textHeight: 42 });
      expect(overrides.run).to.deep.equal({ font: { name: "Consolas" } });

      expect(overrides.list).to.deep.equal({});
      expect(overrides.listItem).to.deep.equal({});
      expect(overrides.listRun).to.deep.equal({});
    });

    it("does not clear children's overrides when clearing block overrides if preserveChildrenStyles is true", () => {
      block.clearStyleOverrides({ preserveChildrenOverrides: true });
      const overrides = getOverrides(block);

      expect(overrides.block).to.deep.equal({});
      expect(overrides.paragraph).to.deep.equal({ textHeight: 42 });
      expect(overrides.run).to.deep.equal({ font: { name: "Consolas" } });

      expect(overrides.list).to.deep.equal({ listMarker: { enumerator: "*", terminator: "period", case: "lower" } });
      expect(overrides.listItem).to.deep.equal({ textHeight: 21 });
      expect(overrides.listRun).to.deep.equal({ font: { name: "Verdana" } });
    });

    it("does not clear children's overrides when clearing paragraph overrides if preserveChildrenStyles is true", () => {
      block.children[0].clearStyleOverrides({ preserveChildrenOverrides: true });
      const overrides = getOverrides(block);
      expect(overrides.block).to.deep.equal({ widthFactor: 1234 });
      expect(overrides.paragraph).to.deep.equal({});
      expect(overrides.run).to.deep.equal({ font: { name: "Consolas" } });

      expect(overrides.list).to.deep.equal({ listMarker: { enumerator: "*", terminator: "period", case: "lower" } });
      expect(overrides.listItem).to.deep.equal({ textHeight: 21 });
      expect(overrides.listRun).to.deep.equal({ font: { name: "Verdana" } });
    });

    it("does not clear children's overrides when clearing list overrides if preserveChildrenStyles is true", () => {
      block.children[0].children[1].clearStyleOverrides({ preserveChildrenOverrides: true });
      const overrides = getOverrides(block);
      expect(overrides.block).to.deep.equal({ widthFactor: 1234 });
      expect(overrides.paragraph).to.deep.equal({ textHeight: 42 });
      expect(overrides.run).to.deep.equal({ font: { name: "Consolas" } });

      expect(overrides.list).to.deep.equal({});
      expect(overrides.listItem).to.deep.equal({ textHeight: 21 });
      expect(overrides.listRun).to.deep.equal({ font: { name: "Verdana" } });
    });

    it("handles empty text block", () => {
      const empty = TextBlock.create();
      expect(empty.styleOverrides).to.deep.equal({});
      expect(() => empty.clearStyleOverrides()).not.to.throw();
    });

    it("creates a deep copy of the style overrides", () => {
      const originalOverrides: TextStyleSettingsProps = { widthFactor: 1234, textHeight: 42, font: { name: "Consolas" }, frame: { shape: "rectangle" }};
      block.styleOverrides = originalOverrides;

      originalOverrides.frame!.shape = "circle";

      expect(block.styleOverrides).to.deep.equal({ widthFactor: 1234, textHeight: 42, font: { name: "Consolas" }, frame: { shape: "rectangle" } });
      expect(originalOverrides.frame!.shape).to.equal("circle");
    });
  });

  describe("stringify", () => {
    it("stringifies text runs", () => {
      const run = TextRun.create();

      // empty
      expect(run.stringify()).to.equal("");

      run.content = "  with some leading whitespace";
      expect(run.stringify()).to.equal("  with some leading whitespace");

      run.content = "with some trailing whitespace  ";
      expect(run.stringify()).to.equal("with some trailing whitespace  ");

      // one word, no whitespace
      run.content = "lorem";
      expect(run.stringify()).to.equal("lorem");
    });

    it("stringifies fraction runs", () => {
      const run = FractionRun.create();

      // both empty
      expect(run.stringify()).to.equal("/");
      expect(run.stringify({ fractionSeparator: "F" })).to.equal("F");

      // both with leading whitespace
      run.numerator = "  ipsum";
      run.denominator = "  dolor";
      expect(run.stringify()).to.equal("  ipsum/  dolor");
      expect(run.stringify({ fractionSeparator: "F" })).to.equal("  ipsumF  dolor");

      // both with trailing whitespace
      run.numerator = "ipsum  ";
      run.denominator = "dolor  ";
      expect(run.stringify()).to.equal("ipsum  /dolor  ");
      expect(run.stringify({ fractionSeparator: "F" })).to.equal("ipsum  Fdolor  "); //cspell: ignore Fdolor Fthe

      // one word, no whitespace
      run.numerator = "ipsum";
      run.denominator = "dolor";
      expect(run.stringify()).to.equal("ipsum/dolor");
      expect(run.stringify({ fractionSeparator: "F" })).to.equal("ipsumFdolor");

      // many words also symbols
      run.numerator = "3.14159 is equal to >";
      run.denominator = "the number π!";
      expect(run.stringify()).to.equal("3.14159 is equal to >/the number π!");
      expect(run.stringify({ fractionSeparator: "F" })).to.equal("3.14159 is equal to >Fthe number π!");
    });

    it("stringifies line break runs", () => {
      const run = LineBreakRun.create();
      expect(run.stringify()).to.equal(" ");
      expect(run.stringify({ lineBreak: "L" })).to.equal("L");
      expect(run.stringify({ lineBreak: "\n" })).to.equal("\n");
    });

    it("stringifies tab runs", () => {
      const run = TabRun.create();
      expect(run.stringify()).to.equal("\t");
      expect(run.stringify({ tabsAsSpaces: 4 })).to.equal("    ");
      expect(run.stringify({ tabsAsSpaces: 7 })).to.equal("       ");
    });

    it("stringifies paragraphs", () => {
      let paragraph = Paragraph.create();

      // empty
      expect(paragraph.stringify()).to.equal("");

      // One child
      paragraph = Paragraph.create(makeParagraph([
        makeTextRun("lorem")
      ]));

      expect(paragraph.stringify()).to.equal("lorem");

      // Multiple children, all the different types of runs
      paragraph = Paragraph.create(makeParagraph([
        makeFractionRun("1", "π"),
        { type: "tab" },
        makeTextRun(" def   ghi"),
        { type: "linebreak" },
        makeTextRun("j k l"),
      ]));

      expect(paragraph.stringify()).to.equal("1/π\t def   ghi j k l");
      expect(paragraph.stringify({ tabsAsSpaces: 4, lineBreak: "L", fractionSeparator: "F" })).to.equal("1Fπ     def   ghiLj k l");
    });

    it("stringifies lists", () => {
      /* Final TextBlock should look like:
        1. lorem
        2. 1/π   def   ghi
        j k l
        3.
      */
      let list = List.create();

      // empty
      expect(list.stringify()).to.equal("");

      // One child
      list = List.create(makeList([
        makeParagraph([
          makeTextRun("lorem")
        ])
      ]));

      expect(list.stringify()).to.equal("1. lorem");
      expect(list.stringify({ listMarkerBreak: "M" })).to.equal("1.Mlorem"); //cspell: ignore 1.Mlorem Mlorem

      // Multiple children, all the different types of runs
      list = List.create(makeList([
        makeParagraph([
          makeTextRun("lorem")
        ]),
        makeParagraph([
          makeFractionRun("1", "π"),
          { type: "tab" },
          makeTextRun(" def   ghi"),
          { type: "linebreak" },
          makeTextRun("j k l"),
        ]),
        makeParagraph(),
      ]));

      // Default list marker is "1."
      expect(list.stringify()).to.equal("1. lorem 2. 1/π\t def   ghi j k l 3. ");
      expect(list.stringify({ tabsAsSpaces: 4, lineBreak: "L", fractionSeparator: "F", listMarkerBreak: "M", paragraphBreak: "P" })).to.equal("1.MloremP2.M1Fπ     def   ghiLj k lP3.M");

      // Unordered list marker
      list.styleOverrides.listMarker = { enumerator: "*" };
      expect(list.stringify()).to.equal("* lorem * 1/π\t def   ghi j k l * ");
      expect(list.stringify({ tabsAsSpaces: 4, lineBreak: "L", fractionSeparator: "F", listMarkerBreak: "M", paragraphBreak: "P" })).to.equal("*MloremP*M1Fπ     def   ghiLj k lP*M");

      // Alphabetic list marker
      list.styleOverrides.listMarker = { enumerator: ListMarkerEnumerator.Letter, terminator: "parenthesis", case: "lower" };
      expect(list.stringify()).to.equal("a) lorem b) 1/π\t def   ghi j k l c) ");
      expect(list.stringify({ tabsAsSpaces: 4, lineBreak: "L", fractionSeparator: "F", listMarkerBreak: "M", paragraphBreak: "P" })).to.equal("a)MloremPb)M1Fπ     def   ghiLj k lPc)M");
    });

    it("stringifies nested lists", () => {
      /* Final TextBlock should look like:
        a. Oranges
        b. Apples
          i. Gala
            • Sweet and crisp
            • From New Zealand
          ii. Fiji
          iii. Red Delicious
      */
      const list = List.create(makeList([
        makeParagraph([
          makeTextRun("Oranges")
        ]),
        makeParagraph([
          makeTextRun("Apples"),
          makeList([
            makeParagraph([
              makeTextRun("Gala"),
              makeList([
                makeParagraph([
                  makeTextRun("Sweet and crisp")
                ]),
                makeParagraph([
                  makeTextRun("From New Zealand"),
                ]),
              ], { listMarker: { enumerator: ListMarkerEnumerator.Bullet } }) // •
            ]),
            makeParagraph([
              makeTextRun("Fiji"),
            ]),
            makeParagraph([
              makeTextRun("Red Delicious"),
            ]),
          ], { listMarker: { enumerator: ListMarkerEnumerator.RomanNumeral, terminator: "period", case: "lower" } })
        ]),
      ], { listMarker: { enumerator: ListMarkerEnumerator.Letter, terminator: "period", case: "lower" } }));

      expect(list.stringify()).to.equal("a. Oranges b. Apples \ti. Gala \t\t• Sweet and crisp \t\t• From New Zealand \tii. Fiji \tiii. Red Delicious");
      expect(list.stringify({ tabsAsSpaces: 3, listMarkerBreak: "M", paragraphBreak: "P" })).to.equal("a.MOrangesPb.MApplesP   i.MGalaP      •MSweet and crispP      •MFrom New ZealandP   ii.MFijiP   iii.MRed Delicious");
    });

    it("stringifies the whole TextBlock", () => {
      /* Final TextBlock should look like:
        1/π   def   ghi
        j k l
        a. Oranges
        b. Apples
          i. Gala
            • Sweet and crisp
            • From New Zealand
          ii. Fiji
          iii. Red Delicious
      */

      const block = TextBlock.create({
        children: [
          makeParagraph([
            makeFractionRun("1", "π"),
            { type: "tab" },
            makeTextRun(" def   ghi"),
            { type: "linebreak" },
            makeTextRun("j k l"),
          ]),
          makeInnerList([
            makeParagraph([
              makeTextRun("Oranges")
            ]),
            makeParagraph([
              makeTextRun("Apples"),
              makeList([
                makeParagraph([
                  makeTextRun("Gala"),
                  makeList([
                    makeParagraph([
                      makeTextRun("Sweet and crisp")
                    ]),
                    makeParagraph([
                      makeTextRun("From New Zealand"),
                    ]),
                  ], { listMarker: { enumerator: ListMarkerEnumerator.Bullet } }) // •
                ]),
                makeParagraph([
                  makeTextRun("Fiji"),
                ]),
                makeParagraph([
                  makeTextRun("Red Delicious"),
                ]),
              ], { listMarker: { enumerator: ListMarkerEnumerator.RomanNumeral, terminator: "period", case: "lower" } })
            ]),
          ], { listMarker: { enumerator: ListMarkerEnumerator.Letter, terminator: "period", case: "lower" } })
        ]
      });

      expect(block.stringify()).to.equal("1/π\t def   ghi j k l a. Oranges b. Apples \ti. Gala \t\t• Sweet and crisp \t\t• From New Zealand \tii. Fiji \tiii. Red Delicious");
      expect(block.stringify({ tabsAsSpaces: 3, lineBreak: "L", fractionSeparator: "F", listMarkerBreak: "M", paragraphBreak: "P" })).to.equal("1Fπ    def   ghiLj k lPa.MOrangesPb.MApplesP   i.MGalaP      •MSweet and crispP      •MFrom New ZealandP   ii.MFijiP   iii.MRed Delicious");
    });
  });
});

describe("TextBlock", () => {
  describe("appendParagraph", () => {
    it("creates a paragraph with no overrides by default", () => {
      const tb = TextBlock.create({ styleOverrides: { textHeight: 42 } });
      const p = tb.appendParagraph();
      expect(p.styleOverrides).to.deep.equal({});

      const p2 = tb.appendParagraph();
      expect(p2.styleOverrides).to.deep.equal({});

      expect(tb.children.length).to.equal(2);
    });

    it("uses the overrides of the last paragraph if one exists and seedFromLast is true", () => {
      const tb = TextBlock.create({ styleOverrides: { textHeight: 42 } });
      const p1Props = { styleOverrides: { isBold: true } };
      tb.appendParagraph(p1Props);

      expect(tb.children[0].styleOverrides).to.deep.equal(p1Props.styleOverrides);

      const p2 = tb.appendParagraph(undefined, true);
      expect(p2.styleOverrides).to.deep.equal(p1Props.styleOverrides);
    });

    it("creates a paragraph with no overrides if none exist even if seedFromLast is true", () => {
      const tb = TextBlock.create({ styleOverrides: { textHeight: 42 } });
      const p1 = tb.appendParagraph(undefined, true);
      expect(p1.styleOverrides).to.deep.equal({});
    });
  });

  describe("appendRun", () => {
    it("appends a paragraph IFF the text block is empty", () => {
      const tb = TextBlock.create();

      // No children to start with
      expect(tb.children.length).to.equal(0);

      // First item creates a paragraph
      tb.appendRun(TextRun.create());
      expect(tb.children.length).to.equal(1);
      expect(tb.children[0].children.length).to.equal(1);

      // Append again adds to the existing paragraph
      tb.appendRun(TextRun.create());
      expect(tb.children.length).to.equal(1);
      expect(tb.children[0].children.length).to.equal(2);
    });
  });

  it("adds items to list", () => {
    /* Final TextBlock should look like:
      1. item 11/π
      2. item 2
      3. item 3
        1. sub item a1/π
        2. sub item b
        3. sub item c
    */

    const props: TextBlockProps = {
      children: [
        makeInnerList([
          makeParagraph([makeTextRun("item 1"), makeFractionRun("1", "π")]),
          makeParagraph([makeTextRun("item 2")]),
          makeParagraph([
            makeTextRun("item 3"),
            makeList([
              makeParagraph([makeTextRun("sub item a"), makeFractionRun("1", "π")]),
              makeParagraph([makeTextRun("sub item b")]),
              makeParagraph([makeTextRun("sub item c")]),
            ]),
          ]),
        ]),
      ],
    };

    const tb = TextBlock.create(props);
    expect(tb.children.length).to.equal(1);
    const list = tb.children[0].children[0] as List;
    expect(list.children).toBeDefined();
    expect(list.children.length).to.equal(3);

    const listItem0 = list.children[0];
    const listItem1 = list.children[1];
    const listItem2 = list.children[2];

    expect(listItem0.type).toBe("paragraph");
    expect(listItem0.children.length).toBe(2);
    expect(listItem0.stringify()).toBe("item 11/π");

    expect(listItem1.type).toBe("paragraph");
    expect(listItem1.children.length).toBe(1);
    expect(listItem1.stringify()).toBe("item 2");

    expect(listItem2.type).toBe("paragraph");
    expect(listItem2.children.length).toBe(2);
    expect(listItem2.stringify()).toBe("item 3 1. sub item a1/π 2. sub item b 3. sub item c");

    const subList = listItem2.children[1] as List;
    expect(subList.children).toBeDefined();
    expect(subList.children.length).toEqual(3);

    const subListItem0 = subList.children[0];
    const subListItem1 = subList.children[1];
    const subListItem2 = subList.children[2];

    expect(subListItem0.type).toBe("paragraph");
    expect(subListItem0.children.length).toBe(2);
    expect(subListItem0.stringify()).toBe("sub item a1/π");

    expect(subListItem1.type).toBe("paragraph");
    expect(subListItem1.children.length).toBe(1);
    expect(subListItem1.stringify()).toBe("sub item b");

    expect(subListItem2.type).toBe("paragraph");
    expect(subListItem2.children.length).toBe(1);
    expect(subListItem2.stringify()).toBe("sub item c");
  });
});

describe("FieldRun", () => {
  describe("create", () => {
    it("initializes fields", () => {
      const fieldRun = FieldRun.create({
        propertyHost: { elementId: "0x123", schemaName: "TestSchema", className: "TestClass" },
        propertyPath: { propertyName: "someProperty", accessors: [0, "nestedProperty"] },
        cachedContent: "cachedValue",
      });

      expect(fieldRun.propertyHost.elementId).to.equal("0x123");
      expect(fieldRun.propertyHost.schemaName).to.equal("TestSchema");
      expect(fieldRun.propertyHost.className).to.equal("TestClass");
      expect(fieldRun.propertyPath).to.deep.equal({ propertyName: "someProperty", accessors: [0, "nestedProperty"] });
      expect(fieldRun.cachedContent).to.equal("cachedValue");
    });

    it("initializes cachedContent to invalid content indicator if undefined", () => {
      expect(FieldRun.create({
        propertyHost: { elementId: "0x123", schemaName: "TestSchema", className: "TestClass" },
        propertyPath: { propertyName: "someProperty", accessors: [0, "nestedProperty"] },
      }).cachedContent).toEqual(FieldRun.invalidContentIndicator);
    });

    it("deeply clones propertyPath", () => {
      const propertyPath = { propertyName: "array1", accessors: [0, "nestedProperty"] };

      const fieldRun = FieldRun.create({
        propertyHost: { elementId: "0x123", schemaName: "TestSchema", className: "TestClass" },
        propertyPath,
      });

      // Modify the original propertyPath to ensure the FieldRun's copy is unaffected
      propertyPath.accessors[0] = 1;

      expect(fieldRun.propertyPath).to.deep.equal({ propertyName: "array1", accessors: [0, "nestedProperty"] });
    });

    it("deeply clones formatter", () => {
      const formatter = { prefix: "abc", bool: { trueString: "yay!", falseString: "boo!" } };

      const fieldRun = FieldRun.create({
        propertyHost: { elementId: "0x123", schemaName: "TestSchema", className: "TestClass" },
        propertyPath: { propertyName: "someProperty", accessors: [0, "nestedProperty"] },
        formatOptions: formatter,
      });

      // Modify the original formatter to ensure the FieldRun's copy is unaffected
      formatter.prefix = "cba";
      formatter.bool.trueString = "woohoo!"; // cspell: ignore woohoo

      expect(fieldRun.formatOptions).to.deep.equal({ prefix: "abc", bool: { trueString: "yay!", falseString: "boo!" } });
    });

    it("deeply clones propertyHost", () => {
      const propertyHost = { elementId: "0x123", schemaName: "TestSchema", className: "TestClass" };

      const fieldRun = FieldRun.create({
        propertyHost,
        propertyPath: { propertyName: "someProperty", accessors: [0, "nestedProperty"] },
      });

      // Modify the original propertyHost to ensure the FieldRun's copy is unaffected
      propertyHost.elementId = "0x456";
      propertyHost.schemaName = "OtherSchema";
      propertyHost.className = "OtherClass";

      expect(fieldRun.propertyHost).to.deep.equal({ elementId: "0x123", schemaName: "TestSchema", className: "TestClass" });
    });
  });

  describe("toJSON", () => {
    it("serializes and deserializes FieldRun correctly", () => {
      const fieldRun = FieldRun.create({
        propertyHost: { elementId: "0x123", schemaName: "TestSchema", className: "TestClass" },
        propertyPath: { propertyName: "someProperty", accessors: [0, "nestedProperty"] },
        cachedContent: "cachedValue",
      });

      const json = fieldRun.toJSON();
      const deserialized = FieldRun.create(json);

      expect(deserialized.equals(fieldRun)).to.be.true;
    });

    it("omits cachedContent if it is equal to invalid content indicator", () => {
      const fieldRun = FieldRun.create({
        propertyHost: { elementId: "0x123", schemaName: "TestSchema", className: "TestClass" },
        propertyPath: { propertyName: "someProperty", accessors: [0, "nestedProperty"] },
        cachedContent: FieldRun.invalidContentIndicator,
      });

      expect(fieldRun.toJSON().cachedContent).to.be.undefined;
    });
  });

  describe("stringify", () => {
    it("produces cached content", () => {
      const fieldRun = FieldRun.create({
        propertyHost: { elementId: "0x123", schemaName: "TestSchema", className: "TestClass" },
        propertyPath: { propertyName: "someProperty", accessors: [0, "nestedProperty"] },
        cachedContent: "cachedValue",
      });

      expect(fieldRun.stringify()).to.equal("cachedValue");
    });
  });

  describe("equals", () => {
    it("compares FieldRuns for equality", () => {
      const baseProps = {
        propertyHost: { elementId: "0x123", schemaName: "TestSchema", className: "TestClass" },
        propertyPath: { propertyName: "someProperty", accessors: [0, "nestedProperty"] },
        cachedContent: "cachedValue",
      };

      const combinations = [
        { propertyHost: { elementId: "0x456", schemaName: "OtherSchema", className: "OtherClass" } },
        { propertyHost: { elementId: "0x456", schemaName: "TestSchema", className: "TestClass" } },
        { propertyHost: { elementId: "0x123", schemaName: "OtherSchema", className: "OtherClass" } },

        { propertyPath: { propertyName: "otherProperty", accessors: [0, "nestedProperty"] } },
        { propertyPath: { propertyName: "someProperty", accessors: [1, "nestedProperty"] } },
        { propertyPath: { propertyName: "someProperty", accessors: [0, "otherNestedProperty"] } },
        { propertyPath: { propertyName: "someProperty", accessors: [0, "nestedProperty", "extraNestedProperty"] } },
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
        propertyHost: { elementId: "0x123", schemaName: "TestSchema", className: "TestClass" },
        propertyPath: { propertyName: "someProperty", accessors: [0, "nestedProperty"] },
        cachedContent: "1",
      });

      const field2 = FieldRun.create({
        propertyHost: { elementId: "0x123", schemaName: "TestSchema", className: "TestClass" },
        propertyPath: { propertyName: "someProperty", accessors: [0, "nestedProperty"] },
        cachedContent: "2",
      });

      expect(field1.equals(field2)).to.be.true;
    });
  });
});

describe('traverseTextBlockComponent', () => {
  it('iterates through all runs in a TextBlock', () => {
    /*
    Text block to create:
      Hello
      1/2

      1. Item 1
      Continued
        1. Sub-item 1
    */
    const textBlock = TextBlock.create();

    const p1 = textBlock.appendParagraph();
    p1.children.push(TextRun.create({ content: "Hello" }));
    p1.children.push(LineBreakRun.create());
    p1.children.push(FractionRun.create({ numerator: "1", denominator: "2" }));

    const p2 = textBlock.appendParagraph();

    const list = List.create();
    p2.children.push(list);
    const listItem = Paragraph.create();
    listItem.children.push(TextRun.create({ content: "Item 1" }));
    listItem.children.push(LineBreakRun.create());
    listItem.children.push(TextRun.create({ content: "Continued" }));

    const childList = List.create();
    listItem.children.push(childList);
    childList.children.push(Paragraph.create({ children: [{type: "text", content: "Sub-item 1"}] }));
    list.children.push(listItem);

    const iterator = traverseTextBlockComponent(textBlock);
    let result = iterator.next();
    expect(result.value.child).toEqual(p1);
    expect(result.value.parent).to.equal(textBlock);

    result = iterator.next();
    expect(result.value.child).toEqual(p1.children[0]);
    expect(result.value.parent).to.equal(p1);

    result = iterator.next();
    expect(result.value.child).toEqual(p1.children[1]);
    expect(result.value.parent).to.equal(p1);

    result = iterator.next();
    expect(result.value.child).toEqual(p1.children[2]);
    expect(result.value.parent).to.equal(p1);

    result = iterator.next();
    expect(result.value.child).toEqual(p2);
    expect(result.value.parent).to.equal(textBlock);

    result = iterator.next();
    expect(result.value.child).toEqual(list);
    expect(result.value.parent).to.equal(p2);

    result = iterator.next();
    expect(result.value.child).toEqual(list.children[0]);
    expect(result.value.parent).to.equal(list);

    result = iterator.next();
    expect(result.value.child).toEqual(list.children[0].children[0]);
    expect(result.value.parent).to.equal(list.children[0]);

    result = iterator.next();
    expect(result.value.child).toEqual(list.children[0].children[1]);
    expect(result.value.parent).to.equal(list.children[0]);

    result = iterator.next();
    expect(result.value.child).toEqual(list.children[0].children[2]);
    expect(result.value.parent).to.equal(list.children[0]);

    result = iterator.next();
    expect(result.value.child).toEqual(list.children[0].children[3]);
    expect(result.value.parent).to.equal(list.children[0]);

    result = iterator.next();
    expect(list.children[0].children[3] as List).toBeDefined();
    expect(result.value.child).toEqual((list.children[0].children[3] as List).children[0]);
    expect(result.value.parent).to.equal(list.children[0].children[3]);

    result = iterator.next();
    expect(list.children[0].children[3] as List).toBeDefined();
    expect(result.value.child).toEqual((list.children[0].children[3] as List).children[0].children[0]);
    expect(result.value.parent).to.equal((list.children[0].children[3] as List).children[0]);

    result = iterator.next();
    expect(result.done).to.be.true;
  });

})

// cspell:ignore Consolas PPPLPF Pmno Verdana
