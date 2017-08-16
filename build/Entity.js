"use strict";
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const EntityMetaData_1 = require("./EntityMetaData");
/** Base class for all ECEntityClasses. */
class Entity {
    constructor(opt) {
        this.iModel = opt.iModel;
        EntityMetaData_1.EntityMetaData.forEachProperty(this.iModel, this.schemaName, this.className, true, (propname, ecprop) => {
            if (!ecprop.isCustomHandled)
                this[propname] = opt[propname];
        });
    }
    /** Get the full name of this class, in the form "schema.class"  */
    static get sqlName() { return this.schema.name + "." + this.name; }
    /** Get the name of the schema that defines this class */
    get schemaName() { return Object.getPrototypeOf(this).constructor.schema.name; }
    /** Get the name of this class */
    get className() { return Object.getPrototypeOf(this).constructor.name; }
}
exports.Entity = Entity;
