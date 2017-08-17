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
const ClassRegistry_1 = require("./ClassRegistry");
/** Base class for all schema classes. */
class Schema {
    get name() { return this.constructor.name; }
    static getFullClassName(className) { return this.name + "." + className; }
    /**
     * Get the ClassCtor for the specified class name
     * @param className The name of the Entity
     * @param imodel The IModel that contains the class definitions
     * @return The corresponding ClassCtor
     */
    static getClass(className, imodel) {
        return __awaiter(this, void 0, void 0, function* () {
            return ClassRegistry_1.ClassRegistry.getClass({ schema: this.name, name: className }, imodel);
        });
    }
}
exports.Schema = Schema;
/** Manages registered schemas */
class Schemas {
    /** Register a schema prior to using it.  */
    static registerSchema(schema) {
        const key = schema.name.toLowerCase();
        if (Schemas.getRegisteredSchema(key))
            throw new Error("schema " + key + " is already registered");
        Schemas._registeredSchemas[key] = schema;
    }
    /**
     * Look up a previously registered schema
     * @param schemaName The name of the schema
     * @return the previously registered schema or undefined if not registered.
     */
    static getRegisteredSchema(schemaName) {
        return Schemas._registeredSchemas[schemaName.toLowerCase()];
    }
}
Schemas._registeredSchemas = {};
exports.Schemas = Schemas;
