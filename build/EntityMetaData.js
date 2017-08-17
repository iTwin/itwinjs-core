"use strict";
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
/** A custom attribute instance */
class CustomAttribute {
}
exports.CustomAttribute = CustomAttribute;
/** Metadata for a property. */
class PropertyMetaData {
}
exports.PropertyMetaData = PropertyMetaData;
/** Metadata for an PropertyMetaData that is a primitive type. */
class PrimitivePropertyMetaData extends PropertyMetaData {
}
exports.PrimitivePropertyMetaData = PrimitivePropertyMetaData;
/** Metadata for an PropertyMetaData that is a Navigation property (aka a pointer to another element in the iModel). */
class NavigationPropertyMetaData extends PropertyMetaData {
}
exports.NavigationPropertyMetaData = NavigationPropertyMetaData;
/** Metadata for an PropertyMetaData that is a struct. */
class StructPropertyMetaData extends PropertyMetaData {
}
exports.StructPropertyMetaData = StructPropertyMetaData;
/** Metadata for an PropertyMetaData that is a primitive array. */
class PrimitiveArrayPropertyMetaData extends PropertyMetaData {
}
exports.PrimitiveArrayPropertyMetaData = PrimitiveArrayPropertyMetaData;
/** Metadata for an PropertyMetaData that is a struct array. */
class StructArrayPropertyMetaData extends PropertyMetaData {
}
exports.StructArrayPropertyMetaData = StructArrayPropertyMetaData;
/** Metadata  for an Entity. */
class EntityMetaData {
    /** Invokd a callback on each property of the specified class, optionally including superclass properties.
     * @param imodel  The IModel that contains the schema
     * @param schemaName The schema that defines the class
     * @param className The name of the class
     * @param wantAllProperties If true, superclass properties will also be processed
     * @param cb  The callback to be invoked on each property
     */
    static forEachProperty(imodel, schemaName, className, wantAllProperties, cb) {
        const mdata = imodel.classMetaDataRegistry.get(schemaName, className);
        if (mdata === undefined) {
            throw new TypeError(schemaName + "." + className + " missing class metadata");
        }
        for (const propname in mdata.properties) {
            if (typeof propname === "string") {
                const ecprop = mdata.properties[propname];
                cb(propname, ecprop);
            }
        }
        if (!wantAllProperties)
            return;
        if (mdata.baseClasses) {
            for (const base of mdata.baseClasses) {
                EntityMetaData.forEachProperty(imodel, base.schema, base.name, true, cb);
            }
        }
    }
}
exports.EntityMetaData = EntityMetaData;
