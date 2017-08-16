"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
const Element_1 = require("./Element");
const IModel_1 = require("./IModel");
const ClassRegistry_1 = require("./ClassRegistry");
const LRUMap_1 = require("@bentley/bentleyjs-core/lib/LRUMap");
const Assert_1 = require("@bentley/bentleyjs-core/lib/Assert");
/** The collection of Elements in an iModel  */
class Elements {
    /** get the map of loaded elements */
    get loaded() { return this._loaded; }
    constructor(iModel, maxElements = 2000) { this._iModel = iModel; this._loaded = new LRUMap_1.LRUMap(maxElements); }
    /**
     * Get an element by Id or Code.
     * @param opts  Either the id or the code of the element
     * @returns The Element or undefined if the Id is not found
     */
    getElement(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            // first see if the element is already in the local cache.
            if (opts.id) {
                const loaded = this._loaded.get(opts.id.toString());
                if (loaded)
                    return { result: loaded };
            }
            // Must go get the element from the iModel. Start by requesting the element's data.
            const getObj = yield this._iModel.dgnDb.getElement(JSON.stringify(opts));
            if (getObj.error || !getObj.result) {
                return { result: undefined }; // we didn't find an element with the specified identity. That's not an error, just an empty result.
            }
            const json = getObj.result;
            const props = JSON.parse(json);
            props.iModel = this._iModel;
            const elObj = yield ClassRegistry_1.ClassRegistry.createInstance(props);
            if (elObj.error)
                return { error: elObj.error };
            const el = elObj.result;
            Assert_1.assert(el instanceof Element_1.Element);
            // We have created the element. Cache it before we return it.
            this._loaded.set(el.id.toString(), el);
            return { result: el };
        });
    }
    /** The Id of the root subject element. */
    get rootSubjectId() {
        return new IModel_1.Id("0x1");
    }
    /** Get the root subject element. */
    getRootSubject() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.getElement({ id: this.rootSubjectId });
        });
    }
}
exports.Elements = Elements;
