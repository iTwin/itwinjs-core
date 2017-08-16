/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Code, IModel, Id } from "../IModel";
import { ColorDef } from "../Render";
import { ElementProps, Element, GeometricElement3d, Subject } from "../Element";
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
    assert.exists(imodel);
  });

  it("should get ECClass metadata for various classes", async () => {
    const imodel: IModel = await IModelTestUtils.openIModel("test.bim", true);
    const { result: elementECClass } = await BisCore.getClass(Element.name, imodel);
    const { result: categoryECClass } = await BisCore.getClass(Category.name, imodel);
    assert.equal(elementECClass!.name, "Element");
    assert.equal(categoryECClass!.name, "Category");
  });
});

describe("Elements", async () => {

  it("should load a known element by Id from an existing iModel", async () => {
    const imodel: IModel = await IModelTestUtils.openIModel("test.bim", true);
    assert.exists(imodel);
    const elements: Elements = imodel.elements;
    assert.exists(elements);
    const code1 = new Code({ spec: "0x10", scope: "0x11", value: "RF1.dgn" });
    const { result: el } = await elements.getElement({ code: code1 });
    assert.exists(el);
    const { result: el2 } = await elements.getElement({ id: "0x34" });
    assert.exists(el2);
    const badCode = new Code({ spec: "0x10", scope: "0x11", value: "RF1_does_not_exist.dgn" });
    const { result: bad } = await elements.getElement({ code: badCode });
    assert.isUndefined(bad);
    const { result: subCat } = await elements.getElement({ id: "0x2e" });
    assert.isTrue(subCat instanceof SubCategory);
    if (subCat) {
      assert.isTrue(subCat.appearance.color.rgba === 16777215);
      assert.isTrue(subCat.appearance.weight === 2);
      assert.isTrue(subCat.id.lo === 46);
      assert.isTrue(subCat.id.hi === 0);
      assert.isTrue(subCat.code.spec.lo === 30);
      assert.isTrue(subCat.code.spec.hi === 0);
      assert.isTrue(subCat.code.scope === "0X2D");
      assert.isTrue(subCat.code.value === "A-Z013-G-Legn");
    }


    /// Get the parent Category of the subcategory.
    const { result: cat } = await elements.getElement({ id: (subCat as SubCategory).getCategoryId() });
    assert.isTrue(cat instanceof Category);
    if (cat) {
      assert.isTrue(cat.id.lo === 45);
      assert.isTrue(cat.id.hi === 0);
      // assert.isTrue(cat.description === "Legends, symbols keys");
      assert.isTrue(cat.code.spec.lo === 22);
      assert.isTrue(cat.code.spec.hi === 0);
      assert.isTrue(cat.code.value === "A-Z013-G-Legn");
    }

    const { result: phys } = await elements.getElement({ id: "0x38", noGeometry: false });
    assert.isTrue(phys instanceof GeometricElement3d);
  });

  it("should have a valid root subject element", async () => {
    const imodel: IModel = await IModelTestUtils.openIModel("test.bim", true);
    assert.exists(imodel);
    const { result: rootSubject } = await imodel.elements.getRootSubject();
    assert.exists(rootSubject);
    assert.isTrue(rootSubject instanceof Subject);
    assert.isAtLeast(rootSubject!.code.getValue().length, 1);

    const childIds: Id[] = await rootSubject!.queryChildren();
    assert.isAtLeast(childIds.length, 1);
    for (const childId of childIds) {
      const { result: childElement } = await imodel.elements.getElement({ id: childId });
      assert.exists(childElement);
      assert.isTrue(childElement instanceof Element);
    }
  });
});

describe("Models", async () => {

  it("should load a known model by Id from an existing iModel", async () => {
    const imodel: IModel = await IModelTestUtils.openIModel("test.bim", true);
    assert.exists(imodel);
    const models: Models = imodel.models;
    assert.exists(models);
    const { result: model2 } = await models.getModel({ id: "0x1c" });
    assert.exists(model2);
    let { result: model } = await models.getModel({ id: "0x1" });
    assert.exists(model);
    const code1 = new Code({ spec: "0x1d", scope: "0x1d", value: "A" });
    ({ result: model } = await models.getModel({ code: code1 }));
    const { result: geomModel } = await ClassRegistry.getClass({ name: "PhysicalModel", schema: "BisCore" }, imodel);
    assert.exists(model);
    assert.isTrue(model instanceof geomModel!);
  });

});
describe("ElementId", () => {

  it("ElementId should construct properly", () => {
    const id1 = new Id("0x123");
    assert.isTrue(id1.isValid(), "good");
    const badid = new Id("0x000");
    assert.isNotTrue(badid.isValid(), "bad");
    const id2 = new Id("badness");
    assert.isNotTrue(id2.isValid());
    const id3 = new Id("0xtbadness");
    assert.isNotTrue(id3.isValid());
    const id4 = new Id("0x1234567890abc");
    assert.isTrue(id4.isValid());
    assert.equal(id4.hi, 0x123);
    const i5 = "0x20000000001";
    const id5 = new Id(i5);
    assert.equal(id5.hi, 0x2);
    assert.equal(id5.lo, 0x1);
    const o5 = id5.toString();
    assert.equal(o5, i5);
    const id6 = new Id([2000000, 3000]);
    const v6 = id6.toString();
    const id7 = new Id(v6);
    assert.isTrue(id6.equals(id7));

    const t1 = { a: id7 };
    const j7 = JSON.stringify(t1);
    const p1 = JSON.parse(j7);
    const i8 = new Id(p1.a);
    assert.isTrue(i8.equals(id7));
  });

  it("Model Selectors should hold models", async () => {
    const imodel1: IModel = await IModelTestUtils.openIModel("test.bim", true);
    const props: ElementProps = {
      iModel: imodel1,
      classFullName: BisCore.name + "." + ModelSelector.name,
      model: new Id([1, 1]),
      code: Code.createDefault(),
      id: new Id(),
    };

    const modelObj = await ClassRegistry.createInstance(props);
    const selector1 = modelObj.result as ModelSelector;
    assert.exists(selector1);
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

    assert.isTrue(color1.equals(color2), "color1 should equal color2");
    assert.isNotTrue(color1.equals(blue), "color1 should not equal blue");

    const blueVal = blue.rgba;
    assert.equal(blueVal, 0xff0000);
    assert.isTrue(blue.equals(new ColorDef(blueVal)));

    const colors = color3.getColors();
    ColorDef.from(colors.r, colors.g, colors.b, 0x30, color3);
    assert.isTrue(color3.equals(ColorDef.from(0xa, 2, 3, 0x30)));
  });
});

describe("Query", () => {

  it("should produce an array of rows", async () => {
    const imodel: IModel = await IModelTestUtils.openIModel("test.bim", true);
    const { result: allrowsdata } = await imodel.executeQuery("SELECT * FROM " + Category.sqlName);
    assert.exists(allrowsdata);
    const rows: any = JSON.parse(allrowsdata!);
    assert.isArray(rows);
    assert.isAtLeast(rows.length, 1);
    assert.exists(rows[0].eCInstanceId);
    assert.notEqual(rows[0].eCInstanceId, "");
  });
});
