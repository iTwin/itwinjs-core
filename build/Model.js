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
const IModel_1 = require("./IModel");
const Entity_1 = require("./Entity");
const ClassRegistry_1 = require("./ClassRegistry");
const JsonUtils_1 = require("@bentley/bentleyjs-core/lib/JsonUtils");
const LRUMap_1 = require("@bentley/bentleyjs-core/lib/LRUMap");
const Assert_1 = require("@bentley/bentleyjs-core/lib/Assert");
/** A Model within an iModel */
class Model extends Entity_1.Entity {
    constructor(props) {
        super(props);
        this.id = new IModel_1.Id(props.id);
        this.modeledElement = new IModel_1.Id(props.modeledElement);
        this.parentModel = new IModel_1.Id(props.parentModel);
        this.isPrivate = JsonUtils_1.JsonUtils.asBool(props.isPrivate);
        this.isTemplate = JsonUtils_1.JsonUtils.asBool(props.isTemplate);
        this.jsonProperties = props.jsonProperties ? props.jsonProperties : {};
    }
}
exports.Model = Model;
/** A geometric model */
class GeometricModel extends Model {
}
exports.GeometricModel = GeometricModel;
/** The collection of Models in an iModel  */
class Models {
    constructor(iModel, max = 500) { this._iModel = iModel; this._loaded = new LRUMap_1.LRUMap(max); }
    /**
     * Get an Model by Id or Code.
     * @param opts  Either the id or the code of the model
     * @returns The Model or undefined if the Id is not found
     */
    getModel(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            // first see if the model is already in the local cache.
            if (opts.id) {
                const loaded = this._loaded.get(opts.id.toString());
                if (loaded)
                    return { result: loaded };
            }
            // Must go get the model from the iModel. Start by requesting the model's data.
            const getObj = yield this._iModel.dgnDb.getModel(JSON.stringify(opts));
            if (getObj.error || !getObj.result) {
                return { result: undefined }; // we didn't find an element with the specified identity. That's not an error, just an empty result.
            }
            const json = getObj.result;
            const props = JSON.parse(json);
            props.iModel = this._iModel;
            const modelObj = yield ClassRegistry_1.ClassRegistry.createInstance(props);
            if (modelObj.error)
                return { error: modelObj.error };
            const model = modelObj.result;
            Assert_1.assert(modelObj.result instanceof Model);
            this._loaded.set(model.id.toString(), model); // We have created the model. Cache it before we return it.
            return { result: model };
        });
    }
}
exports.Models = Models;
