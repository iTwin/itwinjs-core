/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Code, IModel } from "../IModel";
import { ElementProps, Element, GeometricElement3d, InformationPartitionElement, Subject } from "../Element";
import { Models } from "../Model";
import { Category, SubCategory } from "../Category";
import { ClassRegistry } from "../ClassRegistry";
import { ModelSelector } from "../ViewDefinition";
import { Elements } from "../Elements";
import { IModelTestUtils } from "./IModelTestUtils";
import { BisCore } from "../BisCore";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { ElementPropertyFormatter } from "../ElementPropertyFormatter";

describe("iModel", () => {

  let imodel: IModel;
  let imodel2: IModel;

  before(async () => {
    // First, register any schemas that will be used in the tests.
    BisCore.registerSchema();
    imodel = await IModelTestUtils.openIModel("test.bim", true);
    assert.exists(imodel);
    imodel2 = await IModelTestUtils.openIModel("CompatibilityTestSeed.bim", true);
    assert.exists(imodel);
  });

  after(() => {
    imodel.closeDgnDb();
    imodel2.closeDgnDb();
  });

  it("should use schema to look up classes by name", async () => {
    const { result: elementClass } = await BisCore.getClass(Element.name, imodel);
    const { result: categoryClass } = await BisCore.getClass(Category.name, imodel);
    assert.equal(elementClass!.name, "Element");
    assert.equal(categoryClass!.name, "Category");
  });

  it("should load a known element by Id from an existing iModel", async () => {
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
    if (subCat instanceof SubCategory) {
      assert.isTrue(subCat.appearance.color.tbgr === 16777215);
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
    if (cat instanceof Category) {
      assert.isTrue(cat.id.lo === 45);
      assert.isTrue(cat.id.hi === 0);
      assert.isTrue(cat.description === "Legends, symbols keys");
      assert.isTrue(cat.code.spec.lo === 22);
      assert.isTrue(cat.code.spec.hi === 0);
      assert.isTrue(cat.code.value === "A-Z013-G-Legn");
    }

    const { result: phys } = await elements.getElement({ id: "0x38", noGeometry: false });
    assert.isTrue(phys instanceof GeometricElement3d);

    const { result: a2 } = await imodel2.elements.getElement({ id: "0x1d" });
    assert.exists(a2);
    assert.isTrue(a2!.federationGuid!.value === "18eb4650-b074-414f-b961-d9cfaa6c8746");
    const { result: el3 } = await imodel2.elements.getElement({ federationGuid: a2!.federationGuid!.value });
    assert.exists(el3);
    assert.notEqual(a2, el3);
    assert.isTrue(a2!.id.equals(el3!.id));
  });

  it("should have a valid root subject element", async () => {
    const { result: rootSubject } = await imodel.elements.getRootSubject();
    assert.exists(rootSubject);
    assert.isTrue(rootSubject instanceof Subject);
    assert.isAtLeast(rootSubject!.code.getValue().length, 1);
    const { result: subModel } = await rootSubject!.getSubModel();
    assert.isUndefined(subModel, "Root subject should not have a subModel");

    const childIds: Id64[] = await rootSubject!.queryChildren();
    assert.isAtLeast(childIds.length, 1);
    for (const childId of childIds) {
      const { result: childElement } = await imodel.elements.getElement({ id: childId });
      assert.exists(childElement);
      assert.isTrue(childElement instanceof Element);
      if (childElement instanceof InformationPartitionElement) {
        const { result: childSubModel } = await childElement.getSubModel();
        assert.exists(childSubModel, "InformationPartitionElements should have a subModel");
      }
    }
  });

  it("should load a known model by Id from an existing iModel", async () => {
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

  it("Model Selectors should hold models", async () => {
    const props: ElementProps = {
      iModel: imodel,
      classFullName: BisCore.name + "." + ModelSelector.name,
      model: new Id64([1, 1]),
      code: Code.createDefault(),
      id: new Id64(),
    };

    const modelObj = await ClassRegistry.createInstance(props);
    const selector1 = modelObj.result as ModelSelector;
    assert.exists(selector1);
    if (selector1) {
      selector1.addModel(new Id64([2, 1]));
      selector1.addModel(new Id64([2, 1]));
      selector1.addModel(new Id64([2, 3]));
    }
  });

  it("should produce an array of rows", async () => {
    const { result: allrowsdata } = await imodel.executeQuery("SELECT * FROM " + Category.sqlName);
    assert.exists(allrowsdata);
    const rows: any = JSON.parse(allrowsdata!);
    assert.isArray(rows);
    assert.isAtLeast(rows.length, 1);
    assert.exists(rows[0].eCInstanceId);
    assert.notEqual(rows[0].eCInstanceId, "");
  });

  it("ElementPropertyFormatter should format", async () => {
    const elements: Elements = imodel.elements;
    const code1 = new Code({ spec: "0x10", scope: "0x11", value: "RF1.dgn" });
    const { result: el } = await elements.getElement({ code: code1 });
    if (undefined === el)
      throw new Error();
    const formatter: ElementPropertyFormatter = new ElementPropertyFormatter(imodel);
    const { result: props } = await formatter.formatProperties(el);
    assert.isArray(props);
    assert.notEqual(props.length, 0);
    const item = props[0];
    assert.isString(item.category);
    assert.isArray(item.properties);
  });
});
