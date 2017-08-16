"use strict";
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const IModel_1 = require("../IModel");
const Render_1 = require("../Render");
const Element_1 = require("../Element");
const Category_1 = require("../Category");
const ClassRegistry_1 = require("../ClassRegistry");
const ViewDefinition_1 = require("../ViewDefinition");
const IModelTestUtils_1 = require("./IModelTestUtils");
const BisCore_1 = require("../BisCore");
// First, register any schemas that will be used in the tests.
BisCore_1.BisCore.registerSchema();
describe("iModel", () => {
    it("should open an existing iModel", () => __awaiter(this, void 0, void 0, function* () {
        const imodel = yield IModelTestUtils_1.IModelTestUtils.openIModel("test.bim", true);
        chai_1.assert.exists(imodel);
    }));
    it("should use schema to look up classes by name", () => __awaiter(this, void 0, void 0, function* () {
        const imodel = yield IModelTestUtils_1.IModelTestUtils.openIModel("test.bim", true);
        const { result: elementClass } = yield BisCore_1.BisCore.getClass(Element_1.Element.name, imodel);
        const { result: categoryClass } = yield BisCore_1.BisCore.getClass(Category_1.Category.name, imodel);
        chai_1.assert.equal(elementClass.name, "Element");
        chai_1.assert.equal(categoryClass.name, "Category");
    }));
});
describe("Elements", () => __awaiter(this, void 0, void 0, function* () {
    it("should load a known element by Id from an existing iModel", () => __awaiter(this, void 0, void 0, function* () {
        const imodel = yield IModelTestUtils_1.IModelTestUtils.openIModel("test.bim", true);
        chai_1.assert.exists(imodel);
        const elements = imodel.elements;
        chai_1.assert.exists(elements);
        const code1 = new IModel_1.Code({ spec: "0x10", scope: "0x11", value: "RF1.dgn" });
        const { result: el } = yield elements.getElement({ code: code1 });
        chai_1.assert.exists(el);
        const { result: el2 } = yield elements.getElement({ id: "0x34" });
        chai_1.assert.exists(el2);
        const badCode = new IModel_1.Code({ spec: "0x10", scope: "0x11", value: "RF1_does_not_exist.dgn" });
        const { result: bad } = yield elements.getElement({ code: badCode });
        chai_1.assert.isUndefined(bad);
        const { result: subCat } = yield elements.getElement({ id: "0x2e" });
        chai_1.assert.isTrue(subCat instanceof Category_1.SubCategory);
        const { result: cat } = yield elements.getElement({ id: subCat.getCategoryId() });
        chai_1.assert.isTrue(cat instanceof Category_1.Category);
        const { result: phys } = yield elements.getElement({ id: "0x38", noGeometry: false });
        chai_1.assert.isTrue(phys instanceof Element_1.GeometricElement3d);
    }));
    it("should have a valid root subject element", () => __awaiter(this, void 0, void 0, function* () {
        const imodel = yield IModelTestUtils_1.IModelTestUtils.openIModel("test.bim", true);
        chai_1.assert.exists(imodel);
        const { result: rootSubject } = yield imodel.elements.getRootSubject();
        chai_1.assert.exists(rootSubject);
        chai_1.assert.isTrue(rootSubject instanceof Element_1.Subject);
        chai_1.assert.isAtLeast(rootSubject.code.getValue().length, 1);
        const { result: subModel } = yield rootSubject.getSubModel();
        chai_1.assert.isUndefined(subModel, "Root subject should not have a subModel");
        const childIds = yield rootSubject.queryChildren();
        chai_1.assert.isAtLeast(childIds.length, 1);
        for (const childId of childIds) {
            const { result: childElement } = yield imodel.elements.getElement({ id: childId });
            chai_1.assert.exists(childElement);
            chai_1.assert.isTrue(childElement instanceof Element_1.Element);
            if (childElement instanceof Element_1.InformationPartitionElement) {
                const { result: childSubModel } = yield childElement.getSubModel();
                chai_1.assert.exists(childSubModel, "InformationPartitionElements should have a subModel");
            }
        }
    }));
}));
describe("Models", () => __awaiter(this, void 0, void 0, function* () {
    it("should load a known model by Id from an existing iModel", () => __awaiter(this, void 0, void 0, function* () {
        const imodel = yield IModelTestUtils_1.IModelTestUtils.openIModel("test.bim", true);
        chai_1.assert.exists(imodel);
        const models = imodel.models;
        chai_1.assert.exists(models);
        const { result: model2 } = yield models.getModel({ id: "0x1c" });
        chai_1.assert.exists(model2);
        let { result: model } = yield models.getModel({ id: "0x1" });
        chai_1.assert.exists(model);
        const code1 = new IModel_1.Code({ spec: "0x1d", scope: "0x1d", value: "A" });
        ({ result: model } = yield models.getModel({ code: code1 }));
        const { result: geomModel } = yield ClassRegistry_1.ClassRegistry.getClass({ name: "PhysicalModel", schema: "BisCore" }, imodel);
        chai_1.assert.exists(model);
        chai_1.assert.isTrue(model instanceof geomModel);
    }));
}));
describe("ElementId", () => {
    it("ElementId should construct properly", () => {
        const id1 = new IModel_1.Id("0x123");
        chai_1.assert.isTrue(id1.isValid(), "good");
        const badid = new IModel_1.Id("0x000");
        chai_1.assert.isNotTrue(badid.isValid(), "bad");
        const id2 = new IModel_1.Id("badness");
        chai_1.assert.isNotTrue(id2.isValid());
        const id3 = new IModel_1.Id("0xtbadness");
        chai_1.assert.isNotTrue(id3.isValid());
        const id4 = new IModel_1.Id("0x1234567890abc");
        chai_1.assert.isTrue(id4.isValid());
        chai_1.assert.equal(id4.hi, 0x123);
        const i5 = "0x20000000001";
        const id5 = new IModel_1.Id(i5);
        chai_1.assert.equal(id5.hi, 0x2);
        chai_1.assert.equal(id5.lo, 0x1);
        const o5 = id5.toString();
        chai_1.assert.equal(o5, i5);
        const id6 = new IModel_1.Id([2000000, 3000]);
        const v6 = id6.toString();
        const id7 = new IModel_1.Id(v6);
        chai_1.assert.isTrue(id6.equals(id7));
        const t1 = { a: id7 };
        const j7 = JSON.stringify(t1);
        const p1 = JSON.parse(j7);
        const i8 = new IModel_1.Id(p1.a);
        chai_1.assert.isTrue(i8.equals(id7));
    });
    it("Model Selectors should hold models", () => __awaiter(this, void 0, void 0, function* () {
        const imodel1 = yield IModelTestUtils_1.IModelTestUtils.openIModel("test.bim", true);
        const props = {
            iModel: imodel1,
            classFullName: BisCore_1.BisCore.name + "." + ViewDefinition_1.ModelSelector.name,
            model: new IModel_1.Id([1, 1]),
            code: IModel_1.Code.createDefault(),
            id: new IModel_1.Id(),
        };
        const modelObj = yield ClassRegistry_1.ClassRegistry.createInstance(props);
        const selector1 = modelObj.result;
        chai_1.assert.exists(selector1);
        if (selector1) {
            selector1.addModel(new IModel_1.Id([2, 1]));
            selector1.addModel(new IModel_1.Id([2, 1]));
            selector1.addModel(new IModel_1.Id([2, 3]));
        }
    }));
    it("ColorDef should compare properly", () => {
        const color1 = Render_1.ColorDef.from(1, 2, 3, 0);
        const color2 = Render_1.ColorDef.from(1, 2, 3, 0);
        const color3 = Render_1.ColorDef.from(0xa, 2, 3, 0);
        const blue = Render_1.ColorDef.blue();
        chai_1.assert.isTrue(color1.equals(color2), "color1 should equal color2");
        chai_1.assert.isNotTrue(color1.equals(blue), "color1 should not equal blue");
        const blueVal = blue.rgba;
        chai_1.assert.equal(blueVal, 0xff0000);
        chai_1.assert.isTrue(blue.equals(new Render_1.ColorDef(blueVal)));
        const colors = color3.getColors();
        Render_1.ColorDef.from(colors.r, colors.g, colors.b, 0x30, color3);
        chai_1.assert.isTrue(color3.equals(Render_1.ColorDef.from(0xa, 2, 3, 0x30)));
    });
});
describe("Query", () => {
    it("should produce an array of rows", () => __awaiter(this, void 0, void 0, function* () {
        const imodel = yield IModelTestUtils_1.IModelTestUtils.openIModel("test.bim", true);
        const { result: allrowsdata } = yield imodel.executeQuery("SELECT * FROM " + Category_1.Category.sqlName);
        chai_1.assert.exists(allrowsdata);
        const rows = JSON.parse(allrowsdata);
        chai_1.assert.isArray(rows);
        chai_1.assert.isAtLeast(rows.length, 1);
        chai_1.assert.exists(rows[0].eCInstanceId);
        chai_1.assert.notEqual(rows[0].eCInstanceId, "");
    }));
});
