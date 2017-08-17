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
const BeSQLite_1 = require("@bentley/bentleyjs-core/lib/BeSQLite");
class IModelTestUtils {
    static openIModel(filename, expectSuccess, readWrite) {
        return __awaiter(this, void 0, void 0, function* () {
            const imodel = new IModel_1.IModel();
            const mode = readWrite ? BeSQLite_1.OpenMode.ReadWrite : BeSQLite_1.OpenMode.Readonly;
            const { error } = yield imodel.openDgnDb(__dirname + "/assets/" + filename, mode);
            chai_1.assert(!expectSuccess || !error);
            return imodel;
        });
    }
}
exports.IModelTestUtils = IModelTestUtils;
