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
const IModelTestUtils_1 = require("./IModelTestUtils");
const ViewDefinition_1 = require("../ViewDefinition");
const BisCore_1 = require("../BisCore");
// First, register any domains that will be used in the tests.
BisCore_1.BisCore.registerSchema();
describe("Class Registry", () => {
    it("should verify the Entity metadata of known element subclasses", () => __awaiter(this, void 0, void 0, function* () {
        const imodel = yield IModelTestUtils_1.IModelTestUtils.openIModel("test.bim", true);
        const elements = imodel.elements;
        const code1 = new IModel_1.Code({ spec: "0x10", scope: "0x11", value: "RF1.dgn" });
        const { result: el } = yield elements.getElement({ code: code1 });
        chai_1.assert(el !== undefined);
        chai_1.assert(el != null);
        if (el) {
            const metaData = yield el.getClassMetaData();
            chai_1.assert.notEqual(metaData, undefined);
            if (undefined === metaData)
                return;
            chai_1.assert.isNotNull(metaData);
            chai_1.assert.equal(metaData.name, el.className);
            chai_1.assert.equal(metaData.schema, el.schemaName);
            // I happen to know that this is a BisCore.RepositoryLink
            chai_1.assert.equal(metaData.name, "RepositoryLink");
            chai_1.assert.equal(metaData.schema, BisCore_1.BisCore.name);
            //  Check the metadata on the class itself
            chai_1.assert.isTrue(metaData.baseClasses.length > 0);
            chai_1.assert.equal(metaData.baseClasses[0].name, "UrlLink");
            chai_1.assert.equal(metaData.customAttributes[0].classFullName.name, "ClassHasHandler");
            //  Check the metadata on the one property that RepositoryLink defines, RepositoryGuid
            chai_1.assert.isDefined(metaData.properties);
            chai_1.assert.isNotNull(metaData.properties);
            chai_1.assert.isDefined(metaData.properties.repositoryGuid);
            const p = metaData.properties.repositoryGuid;
            chai_1.assert.isDefined(p.primitiveECProperty);
            chai_1.assert.equal(p.primitiveECProperty.type, "binary");
            chai_1.assert.equal(p.primitiveECProperty.extendedType, "BeGuid");
            chai_1.assert.equal(p.customAttributes[1].classFullName.name, "HiddenProperty");
        }
        const { result: el2 } = yield elements.getElement({ id: "0x34" });
        chai_1.assert.isDefined(el2);
        chai_1.assert.isNotNull(el2);
        if (el2) {
            const metaData = yield el2.getClassMetaData();
            chai_1.assert.notEqual(metaData, undefined);
            if (undefined === metaData)
                return;
            chai_1.assert.isNotNull(metaData);
            chai_1.assert.equal(metaData.name, el2.className);
            chai_1.assert.equal(metaData.schema, el2.schemaName);
            // I happen to know that this is a BisCore.SpatialViewDefinition
            chai_1.assert.equal(metaData.name, ViewDefinition_1.SpatialViewDefinition.name);
            chai_1.assert.equal(metaData.schema, BisCore_1.BisCore.name);
            chai_1.assert.isTrue(metaData.baseClasses.length > 0);
            chai_1.assert.equal(metaData.baseClasses[0].name, ViewDefinition_1.ViewDefinition3d.name);
            chai_1.assert.isDefined(metaData.properties);
            chai_1.assert.isNotNull(metaData.properties);
            chai_1.assert.isDefined(metaData.properties.modelSelector);
            const n = metaData.properties.modelSelector;
            chai_1.assert.isDefined(n.navigationECProperty);
            chai_1.assert.equal(n.navigationECProperty.relationshipClass.name, "SpatialViewDefinitionUsesModelSelector");
        }
    }));
});
class Base {
    static get sqlName() { return "s." + this.staticProperty; }
}
Base.staticProperty = "base";
class Derived extends Base {
}
describe("Static Properties", () => {
    it("should be inherited, and the subclass should get its own copy", () => __awaiter(this, void 0, void 0, function* () {
        chai_1.assert.equal(Base.staticProperty, "base");
        chai_1.assert.equal(Derived.staticProperty, "base"); // Derived inherits Base's staticProperty (via its prototype)
        Derived.staticProperty = "derived"; // Derived now gets its own copy of staticProperty
        chai_1.assert.equal(Base.staticProperty, "base"); // Base's staticProperty remains as it was
        chai_1.assert.equal(Derived.staticProperty, "derived"); // Derived's staticProperty is now different
        chai_1.assert.equal(Base.sqlName, "s.base");
        const d = new Derived();
        chai_1.assert.equal(Object.getPrototypeOf(d).constructor.staticProperty, "derived"); // Instances of Derived see Derived.staticProperty
        const b = new Base();
        chai_1.assert.equal(Object.getPrototypeOf(b).constructor.staticProperty, "base"); // Instances of Base see Base.staticProperty
    }));
});
