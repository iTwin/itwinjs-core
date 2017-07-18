/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { IModel, Id } from "../IModel";
import { ColorDef } from "../Render";
import { Code, IElement, Element } from "../Element";
import { EcRegistry } from "../EcRegistry";
import { ModelSelector } from "../ViewDefinition";
import { Elements } from "../Elements";
import { Category } from "../Category";
export { Category } from "../Category";
import { IModelTestUtils } from "./IModelTestUtils"

describe("iModel", () => {

  it("should open and existing iModel", async () => {
    const imodel: IModel = await IModelTestUtils.openIModel("test.bim", true);
    assert(imodel);
  });

  it("should get ECClass metadata for various classes", async () => {
    const imodel: IModel = await IModelTestUtils.openIModel("test.bim", true);
    const elementECClass = await Element.getECClass(imodel, "BisCore", "Element");
    const categoryECClass = await Category.getECClass(imodel, "BisCore", "Category");
    assert.equal(elementECClass.name, "Element");
    assert.equal(categoryECClass.name, "Category");
  });
});

describe("Elements", async () => {

  it("should load a known element by Id from an existing iModel", async () => {
    const imodel: IModel = await IModelTestUtils.openIModel("test.bim", true);
    assert(imodel);
    const elements: Elements = imodel.Elements;
    assert(elements);
    const code1 = new Code({ spec: "0x10", scope: "0x11", value: "RF1.dgn" });
    const el = await elements.getElement({ code: code1 });
    assert(el != null);
    const el2 = await elements.getElement({ id: "0x34" });
    assert(el2 != null);

  });

});

describe("ElementId", () => {

  it("ElementId should construct properly", () => {
    const id1 = new Id("0x123");
    assert(id1.isValid(), "good");
    const id2 = new Id("badness");
    assert(!id2.isValid());
    const id3 = new Id("0xtbadness");
    assert(!id3.isValid());
    const id4 = new Id("0x1234567890abc");
    assert(id4.isValid());
    assert(id4.hi === 0x123);
    const i5 = "0X20000000001";
    const id5 = new Id(i5);
    assert(id5.hi === 0x2 && id5.lo === 0x1);
    const o5 = id5.toString();
    assert(o5 === i5);
    const id6 = new Id(100, 200);
    const v6 = id6.toString();
    const id7 = new Id(v6);
    assert(id6.equals(id7));

    const t1 = { a: id7 };
    const j7 = JSON.stringify(t1);
    const p1 = JSON.parse(j7);
    const i8 = new Id(p1.a);
    assert(i8.equals(id7));
  });

  it("Model Selectors should hold models", () => {
    const imodel1 = new IModel();
    const params: IElement = {
      _iModel: imodel1,
      schemaName: "BisCore",
      className: "ModelSelector",
      model: new Id(1, 1),
      code: Code.createDefault(),
      id: new Id(),
    };

    const selector1 = EcRegistry.create(params) as ModelSelector;
    assert(selector1 !== undefined);
    const a = new ModelSelector(params);
    if (selector1) {
      selector1.addModel(new Id(2, 1));
      selector1.addModel(new Id(2, 1));
      selector1.addModel(new Id(2, 3));
    }
  });

  it("ColorDef should compare properly", () => {
    const color1 = ColorDef.from(1, 2, 3, 0);
    const color2 = ColorDef.from(1, 2, 3, 0);
    const color3 = ColorDef.from(0xa, 2, 3, 0);
    const blue = ColorDef.blue();

    assert(color1.equals(color2), "A");
    assert(!color1.equals(blue), "B");

    const blueVal = blue.rgba;
    assert(blueVal === 0xff0000);
    assert(blue.equals(new ColorDef(blueVal)));

    const colors = color3.getColors();
    ColorDef.from(colors.r, colors.g, colors.b, 0x30, color3);
    assert(color3.equals(ColorDef.from(0xa, 2, 3, 0x30)));
  });
});
