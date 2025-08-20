/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { beforeEach, describe, expect, it } from "vitest";
import { ContainerComponentType, FieldRun, FractionRun, FractionRunProps, List, ListProps, Paragraph, ParagraphProps, RunComponentType, RunProps, TextBlock, TextBlockComponent, TextBlockProps, TextRun, TextRunProps, TextStyleSettingsProps } from "../../core-common";

function makeTextRun(content?: string, styleOverrides?: TextStyleSettingsProps): TextRunProps {
  return {
    type: RunComponentType.Text,
    content,
    styleOverrides,
  };
}

function makeFractionRun(numerator?: string, denominator?: string, styleOverrides?: TextStyleSettingsProps): FractionRunProps {
  return {
    type: RunComponentType.Fraction,
    numerator,
    denominator,
    styleOverrides,
  };
}

function makeParagraph(children?: RunProps[], styleOverrides?: TextStyleSettingsProps): ParagraphProps {
  return {
    type: ContainerComponentType.Paragraph,
    styleOverrides,
    children,
  };
}

function makeList(children?: ParagraphProps[], styleOverrides?: TextStyleSettingsProps): ListProps {
  return {
    type: ContainerComponentType.List,
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
    let paragraph: Paragraph | List;

    beforeEach(() => {
      block = TextBlock.create({ styleId: "0x42", styleOverrides: { widthFactor: 1234 }});
      paragraph = block.appendContainer({ type: ContainerComponentType.Paragraph, styleOverrides: { lineHeight: 42 } });
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
          { type: RunComponentType.LineBreak },
          makeTextRun("j k l"),
        ]),
        makeParagraph(),
        makeParagraph([makeTextRun()]),
        makeParagraph([{ type: RunComponentType.LineBreak }]),
        makeParagraph([makeFractionRun()]),
        makeParagraph([makeTextRun("mno")]),
        makeParagraph([{ type: RunComponentType.LineBreak }, { type: RunComponentType.LineBreak }]),
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
    function expectToHaveParentAndRoot(root: TextBlock, parent: TextBlockComponent, current: TextBlockComponent, prev?: TextBlockComponent, next?: TextBlockComponent) {
      expect(current.previousSibling).to.equal(prev);
      expect(current.nextSibling).to.equal(next);
      expect(current.parent).to.equal(parent);
      expect(current.root).to.equal(root);
    }

    const props: TextBlockProps = {
      styleId: "0x42",
      children: [
        makeParagraph([
          makeTextRun("abc"),
        ]),
        makeParagraph([
          makeFractionRun("1", "π"),
          makeTextRun(" def   ghi"),
          { type: RunComponentType.LineBreak },
          { type: RunComponentType.Tab }
        ]),
        makeList([
          makeParagraph([makeTextRun("item 1"), makeFractionRun("1", "π")]),
          makeParagraph([makeTextRun("item 2")]),
          makeParagraph([makeTextRun("item 3")]),
        ]),
      ],
    };

    const tb = TextBlock.create(props);

    expect(tb.root).to.equal(tb);
    expect(tb.children?.length).to.equal(3);

    const p0 = tb.children![0] as Paragraph;
    const p1 = tb.children![1] as Paragraph;
    const p2 = tb.children![2] as List;

    expectToHaveParentAndRoot(tb, tb, p0, undefined, p1);
    expectToHaveParentAndRoot(tb, tb, p1, p0, p2);
    expectToHaveParentAndRoot(tb, tb, p2, p1, undefined);

    expect(p0.children).toBeDefined();
    expect(p1.children).toBeDefined();
    expect(p2.children).toBeDefined();

    const p0Children = p0.children!;
    expect(p0Children.length).to.equal(1);
    p0Children.forEach((run, index) => {
      expectToHaveParentAndRoot(tb, p0, run, p0Children[index - 1], p0Children[index + 1]);
    });

    const p1Children = p1.children!;
    expect(p1Children.length).to.equal(4);
    p1Children.forEach((run, index) => {
      expectToHaveParentAndRoot(tb, p1, run, p1Children[index - 1], p1Children[index + 1]);
    });

    const p2Children = p2.children!;
    expect(p2Children.length).to.equal(3);

    const p2Item0 = p2Children[0] as Paragraph;
    const p2Item1 = p2Children[1] as Paragraph;
    const p2Item2 = p2Children[2] as Paragraph;

    expectToHaveParentAndRoot(tb, p2, p2Item0, undefined, p2Item1);
    expectToHaveParentAndRoot(tb, p2, p2Item1, p2Item0, p2Item2);
    expectToHaveParentAndRoot(tb, p2, p2Item2, p2Item1, undefined);

    expect(p2Item0.children?.length).toBe(1);
    expect(p2Item1.children?.length).toBe(1);
    expect(p2Item2.children?.length).toBe(1);

    expect(p2Item0.children?.[0] instanceof Paragraph).toBeTruthy();
    expect(p2Item1.children?.[0] instanceof TextRun).toBeTruthy();
    expect(p2Item2.children?.[0] instanceof TextRun).toBeTruthy();

    expect(p2Item0.children?.[0].stringify()).toBe("item 11/π");
    expect(p2Item1.children?.[0].stringify()).toBe("item 2");
    expect(p2Item2.children?.[0].stringify()).toBe("item 3");

    expect(p2Item0.children?.[0].children?.length).toBe(2);
    expect(p2Item0.children?.[0].children?.[0] instanceof TextRun).toBeTruthy();
    expect(p2Item0.children?.[0].children?.[1] instanceof FractionRun).toBeTruthy();
  });
});

describe("TextBlock", () => {
  describe("appendParagraph", () => {
    it("creates a paragraph with no overrides by default", () => {
      const tb = TextBlock.create({ styleId: "0x42", styleOverrides: { lineHeight: 42 } });
      const p = tb.appendContainer();
      expect(p.styleOverrides).to.deep.equal({});

      const p2 = tb.appendContainer();
      expect(p2.styleOverrides).to.deep.equal({});

      expect(tb.children?.length).to.equal(2);
    });

    it("uses the overrides of the last paragraph if one exists and seedFromLast is true", () => {
      const tb = TextBlock.create({ styleId: "0x42", styleOverrides: { lineHeight: 42 } });
      const p1 = Paragraph.create({ styleOverrides: { isBold: true } });
      tb.appendContainer(p1);

      const p2 = tb.appendContainer(undefined, true);
      expect(p2.styleOverrides).to.deep.equal(p1.styleOverrides);
    });

    it("creates a paragraph with no overrides if none exist even if seedFromLast is true", () => {
      const tb = TextBlock.create({ styleId: "0x42", styleOverrides: { lineHeight: 42 } });
      const p1 = tb.appendContainer(undefined, true);
      expect(p1.styleOverrides).to.deep.equal({});
    });
  });

  describe("appendRun", () => {
    it("appends a paragraph IFF the text block is empty", () => {
      const tb = TextBlock.create({ styleId: "0x42" });
      expect(tb.children?.length).to.equal(0);

      tb.appendRun(TextRun.create());
      expect(tb.children?.length).to.equal(1);
      expect(tb.children![0].children?.length).to.equal(1);

      tb.appendRun(TextRun.create());
      expect(tb.children?.length).to.equal(1);
      expect(tb.children![0].children?.length).to.equal(2);
    });
  });
});

describe.skip("FieldRun", () => {
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
      const formatter = { formatType: "currency", precision: 2, options: { locale: "en-US", style: "decimal" } };

      const fieldRun = FieldRun.create({
        propertyHost: { elementId: "0x123", schemaName: "TestSchema", className: "TestClass" },
        propertyPath: { propertyName: "someProperty", accessors: [0, "nestedProperty"] },
        formatter,
      });

      // Modify the original formatter to ensure the FieldRun's copy is unaffected
      formatter.formatType = "percentage";
      formatter.precision = 3;
      formatter.options.locale = "fr-FR";
      formatter.options.style = "percent";

      expect(fieldRun.formatter).to.deep.equal({ formatType: "currency", precision: 2, options: { locale: "en-US", style: "decimal" } });
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

        { propertyPath: { propertyName: "otherProperty", accessors: [0, "nestedProperty"], jsonAccessors: ["array", 2] } },
        { propertyPath: { propertyName: "someProperty", accessors: [1, "nestedProperty"], jsonAccessors: ["array", 2] } },
        { propertyPath: { propertyName: "someProperty", accessors: [0, "otherNestedProperty"], jsonAccessors: ["array", 2] } },
        { propertyPath: { propertyName: "someProperty", accessors: [0, "nestedProperty", "extraNestedProperty"], jsonAccessors: ["array", 2] } },
        { propertyPath: { propertyName: "someProperty", accessors: [0, "nestedProperty", "extraNestedProperty"], jsonAccessors: ["array", 3] } },
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

// cspell:ignore Consolas PPPLPF Pmno