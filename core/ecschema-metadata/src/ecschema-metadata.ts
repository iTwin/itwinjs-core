/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

export * from "./Constants";
export * from "./Context";
export * from "./DelayedPromise";
export * from "./Deserialization/SchemaGraphUtil";
export * from "./Deserialization/JsonProps";
export * from "./Deserialization/Helper";
export * from "./Deserialization/XmlParser";
export * from "./ECName";
export * from "./ECObjects";
export * from "./Exception";
export * from "./Interfaces";
export { ECClass, StructClass } from "./Metadata/Class";
export { Constant } from "./Metadata/Constant";
export { CustomAttributeClass } from "./Metadata/CustomAttributeClass";
export { EntityClass } from "./Metadata/EntityClass";
export { AnyEnumerator, Enumeration, Enumerator } from "./Metadata/Enumeration";
export { Format } from "./Metadata/Format";
export { InvertedUnit } from "./Metadata/InvertedUnit";
export { KindOfQuantity } from "./Metadata/KindOfQuantity";
export { Mixin } from "./Metadata/Mixin";
export * from "./Metadata/OverrideFormat";
export { Phenomenon } from "./Metadata/Phenomenon";
export {
  Property, PrimitiveProperty, PrimitiveArrayProperty, EnumerationProperty, StructProperty,
  StructArrayProperty, EnumerationArrayProperty, NavigationProperty, AnyArrayProperty, AnyEnumerationProperty,
  AnyPrimitiveProperty, AnyProperty, AnyStructProperty, ArrayProperty, PrimitiveOrEnumPropertyBase,
} from "./Metadata/Property";
export { PropertyCategory } from "./Metadata/PropertyCategory";
export { RelationshipClass, RelationshipConstraint, RelationshipMultiplicity } from "./Metadata/RelationshipClass";
export { Schema } from "./Metadata/Schema";
export * from "./Metadata/SchemaItem";
export { Unit } from "./Metadata/Unit";
export { UnitSystem } from "./Metadata/UnitSystem";
export * from "./PropertyTypes";
export * from "./SchemaJsonLocater";
export * from "./SchemaKey";
export * from "./SchemaLoader";
export * from "./UnitConversion/UnitConversion";
export * from "./UnitConversion/UnitConverter";
export * from "./UnitProvider/SchemaUnitProvider";
export * from "./Validation/SchemaWalker";
export * from "./SchemaPartVisitorDelegate";
export { CustomAttribute, CustomAttributeContainerProps} from "./Metadata/CustomAttribute";
export { SchemaGraph } from "./utils/SchemaGraph";

/** @docs-package-description
 * The ecschema-metadata package contains classes for working with ECSchemas that can be used in both [frontend]($docs/learning/frontend/index.md) and [backend]($docs/learning/backend/index.md).
 */
/**
 * @docs-group-description Metadata
 * Definitions of classes and interfaces that represent all [EC elements]($docs/bis/ec/index.md).
 */
/**
 * @docs-group-description Utils
 * A set of utility classes used throughout the package.
 */
