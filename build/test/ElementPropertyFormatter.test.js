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
const ElementPropertyFormatter_1 = require("../ElementPropertyFormatter");
const IModelTestUtils_1 = require("./IModelTestUtils");
const BisCore_1 = require("../BisCore");
// First, register any schemas that will be used in the tests.
BisCore_1.BisCore.registerSchema();
describe("ElementPropertyFormatter", () => {
    it("should format", () => __awaiter(this, void 0, void 0, function* () {
        const imodel = yield IModelTestUtils_1.IModelTestUtils.openIModel("test.bim", true);
        const elements = imodel.elements;
        const code1 = new IModel_1.Code({ spec: "0x10", scope: "0x11", value: "RF1.dgn" });
        const { result: el } = yield elements.getElement({ code: code1 });
        if (undefined === el)
            throw new Error();
        const formatter = new ElementPropertyFormatter_1.ElementPropertyFormatter(imodel);
        const { result: props } = yield formatter.formatProperties(el);
        chai_1.assert.isArray(props);
        chai_1.assert.notEqual(props.length, 0);
        const item = props[0];
        chai_1.assert.isString(item.category);
        chai_1.assert.isArray(item.properties);
    }));
});
