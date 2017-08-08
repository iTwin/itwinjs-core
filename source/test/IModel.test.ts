/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Code, IModel, Id } from "../IModel";
import { ColorDef } from "../Render";
import { ElementProps, Element, GeometricElement3d } from "../Element";
import { Models } from "../Model";
import { Category, SubCategory } from "../Category";
import { ClassRegistry } from "../ClassRegistry";
import { ModelSelector } from "../ViewDefinition";
import { Elements } from "../Elements";
import { IModelTestUtils } from "./IModelTestUtils";
import { BisCore } from "../BisCore";

// First, register any schemas that will be used in the tests.
BisCore.registerSchema();

describe("iModel", () => {

  it("should open an existing iModel", async () => {
    const imodel: IModel = await IModelTestUtils.openIModel("test.bim", true);
    assert(imodel);
  });

  it("should get ECClass metadata for various classes", async () => {
    const imodel: IModel = await IModelTestUtils.openIModel("test.bim", true);
    const elementECClass = await BisCore.getClass(Element.name, imodel);
    const categoryECClass = await BisCore.getClass(Category.name, imodel);
    assert.equal(elementECClass.name, "Element");
    assert.equal(categoryECClass.name, "Category");
  });
});

describe("Elements", async () => {

  it("should load a known element by Id from an existing iModel", async () => {
    const imodel: IModel = await IModelTestUtils.openIModel("test.bim", true);
    assert(imodel);
    const elements: Elements = imodel.elements;
    assert(elements);
    const code1 = new Code({ spec: "0x10", scope: "0x11", value: "RF1.dgn" });
    const el = await elements.getElement({ code: code1 });
    assert(el != null);
    const el2 = await elements.getElement({ id: "0x34" });
    assert(el2 != null);
    const badCode = new Code({ spec: "0x10", scope: "0x11", value: "RF1_does_not_exist.dgn" });
    const bad = await elements.getElement({ code: badCode });
    assert(bad === undefined);
    const subcat = await elements.getElement({ id: "0x2e" });
    assert(subcat instanceof SubCategory);
    const cat = await elements.getElement({ id: (subcat as SubCategory).getCategoryId() });
    assert(cat instanceof Category);
    const phys = await elements.getElement({ id: "0x38"});
    assert(phys instanceof GeometricElement3d);
  });
});

describe("Models", async () => {

  it("should load a known model by Id from an existing iModel", async () => {
    const imodel: IModel = await IModelTestUtils.openIModel("test.bim", true);
    assert(imodel);
    const models: Models = imodel.models;
    assert(models);
    const model2 = await models.getModel({ id: "0x1c" });
    assert(model2 != null);
    let model = await models.getModel({ id: "0x1" });
    assert(model != null);
    const code1 = new Code({ spec: "0x1d", scope: "0x1d", value: "A" });
    model = await models.getModel({ code: code1 });
    const geomModel = await ClassRegistry.getClass({ name: "PhysicalModel", schema: "BisCore" }, imodel);
    assert(model instanceof geomModel!);
    assert(model != null);
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
    const id6 = new Id([200, 100]);
    const v6 = id6.toString();
    const id7 = new Id(v6);
    assert(id6.equals(id7));

    const t1 = { a: id7 };
    const j7 = JSON.stringify(t1);
    const p1 = JSON.parse(j7);
    const i8 = new Id(p1.a);
    assert(i8.equals(id7));
  });

  it("Model Selectors should hold models", async () => {
    const imodel1 = new IModel();
    const props: ElementProps = {
      iModel: imodel1,
      schemaName: BisCore.name,
      className: ModelSelector.name,
      model: new Id([1, 1]),
      code: Code.createDefault(),
      id: new Id(),
    };

    const selector1 = await ClassRegistry.createInstance(props) as ModelSelector;
    assert(selector1 !== undefined);
    if (selector1) {
      selector1.addModel(new Id([2, 1]));
      selector1.addModel(new Id([2, 1]));
      selector1.addModel(new Id([2, 3]));
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

describe("Query", () => {

  it("should produce an array of rows", async () => {
    const imodel: IModel = await IModelTestUtils.openIModel("test.bim", true);
    const allrowsdata = await imodel.executeQuery("SELECT * FROM " + Category.sqlName);
    assert.isNotNull(allrowsdata);
    const rows: any = JSON.parse(allrowsdata);
    assert.isArray(rows);
    assert.notEqual(rows.length, 0);
    assert.notEqual(rows[0].ecinstanceid, "");
  });
});
