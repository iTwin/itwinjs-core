"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
const Schema_1 = require("./Schema");
const ClassRegistry_1 = require("./ClassRegistry");
/** Represents the BisCore schema. */
class BisCore extends Schema_1.Schema {
    /** Call this to register the BisCore schema prior to using it. */
    static registerSchema() {
        if (!Schema_1.Schemas.getRegisteredSchema(BisCore.name))
            Schema_1.Schemas.registerSchema(new BisCore());
    }
    // Registers all classes of the BisCore schema.
    constructor() {
        super();
        // this list should include all .ts files with implementations of Entity-based classes. Order does not matter.
        ClassRegistry_1.ClassRegistry.registerModuleClasses(require("./Element"), this);
        ClassRegistry_1.ClassRegistry.registerModuleClasses(require("./Model"), this);
        ClassRegistry_1.ClassRegistry.registerModuleClasses(require("./Category"), this);
        ClassRegistry_1.ClassRegistry.registerModuleClasses(require("./ViewDefinition"), this);
    }
}
exports.BisCore = BisCore;
