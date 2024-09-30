/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Metadata
 */

import { FormatProps } from "@itwin/core-quantity";

/**
 * @beta
 */
export type AnyPropertyProps = PrimitivePropertyProps | StructPropertyProps | PrimitiveArrayPropertyProps | StructArrayPropertyProps | NavigationPropertyProps;
/**
 * @beta
 */
export type AnyClassProps = EntityClassProps | MixinProps | CustomAttributeClassProps | RelationshipClassProps;
/**
 * @beta
 */
export type AnySchemaItemProps = AnyClassProps | EnumerationProps | KindOfQuantityProps | PropertyCategoryProps | SchemaItemUnitProps | InvertedUnitProps | ConstantProps | PhenomenonProps | SchemaItemFormatProps | SchemaItemOverrideFormatProps;

/**
 * @beta
 */
export interface SchemaProps {
  readonly $schema: string;
  readonly name: string;
  readonly version: string;
  readonly alias: string;
  readonly label?: string;
  readonly description?: string;
  readonly references?: SchemaReferenceProps[];
  readonly items?: { [name: string]: SchemaItemProps };
  readonly customAttributes?: Array<{ [value: string]: any }>;
  readonly ecXmlMajorVersion?: number;
  readonly ecXmlMinorVersion?: number;
}

/**
 * JSON Object interface used to deserialize into a [[SchemaKey]].
 * @beta
 */
export interface SchemaKeyProps {
  /** The schema name */
  readonly name: string;
  /** Read version of the schema */
  readonly read: number;
  /** Write version of the schema */
  readonly write: number;
  /** Minor version of the schema */
  readonly minor: number;
}

/**
 * @beta
 */
export interface SchemaReferenceProps {
  readonly name: string;
  readonly version: string;
}

/**
 * @beta
 */
export interface SchemaItemProps {
  // NEEDSWORK: Still need to clarify how single-item deserialization works...
  readonly $schema?: string;
  readonly schema?: string;  // conditionally required
  readonly schemaVersion?: string;
  readonly name?: string;
  readonly schemaItemType?: string;
  readonly label?: string;
  readonly description?: string;
  readonly customAttributes?: Array<{ [value: string]: any }>;
  readonly originalECXmlMajorVersion?: number;
  readonly originalECXmlMinorVersion?: number;
}

/**
 * @beta
 */
export interface ClassProps extends SchemaItemProps {
  readonly modifier?: string;
  readonly baseClass?: string;
  readonly properties?: AnyPropertyProps[];
}

/**
 * @beta
 */
export interface EntityClassProps extends ClassProps {
  readonly mixins?: string[];
}

/**
 * @beta
 */
export interface MixinProps extends ClassProps {
  readonly appliesTo: string;
}

/**
 * @beta
 */
export type StructClassProps = ClassProps;

/**
 * @beta
 */
export interface CustomAttributeClassProps extends ClassProps {
  /**
   * Can be any combination of the [CustomAttributeContainerType]$(docs/bis/ec/customattribute-container-types.md) string values
   * separated by commas.
   */
  readonly appliesTo: string;
}

/**
 * @beta
 */
export interface RelationshipClassProps extends ClassProps {
  readonly strength: string;
  readonly strengthDirection: string;
  readonly source: RelationshipConstraintProps;
  readonly target: RelationshipConstraintProps;
}

/**
 * @beta
 */
export interface RelationshipConstraintProps {
  readonly multiplicity: string;
  readonly roleLabel: string;
  readonly polymorphic: boolean;
  readonly abstractConstraint?: string;
  readonly constraintClasses: string[];
}

/**
 * @beta
 */
export interface EnumerationProps extends SchemaItemProps {
  readonly type: string;
  readonly isStrict: boolean;
  readonly enumerators: EnumeratorProps[];
}

/**
 * @beta
 */
export interface EnumeratorProps {
  readonly name: string;
  readonly value: string | number;
  readonly label?: string;
  readonly description?: string;
}

/**
 * @beta
 */
export interface KindOfQuantityProps extends SchemaItemProps {
  readonly persistenceUnit: string;
  readonly presentationUnits?: string | string[];
  readonly relativeError: number;
}

/**
 * @beta
 */
export interface PropertyCategoryProps extends SchemaItemProps {
  readonly priority: number;
}

/**
 * @beta
 */
export interface PropertyProps {
  readonly name: string;
  readonly type: string;
  readonly description?: string;
  readonly label?: string;
  readonly isReadOnly?: boolean;
  readonly category?: string;
  readonly priority?: number;
  readonly inherited?: boolean;
  readonly kindOfQuantity?: string;
  readonly customAttributes?: Array<{ [value: string]: any }>;
}

/**
 * @beta
 */
export interface PrimitiveOrEnumPropertyBaseProps extends PropertyProps {
  readonly extendedTypeName?: string;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly minValue?: number;
  readonly maxValue?: number;
}

/**
 * @beta
 */
export interface PrimitivePropertyProps extends PrimitiveOrEnumPropertyBaseProps {
  readonly typeName: string;
}

/**
 * @beta
 */
export interface StructPropertyProps extends PropertyProps {
  readonly typeName: string;
}

/**
 * @beta
 */
export interface EnumerationPropertyProps extends PrimitiveOrEnumPropertyBaseProps {
  readonly typeName: string;
}

/**
 * @beta
 */
export interface ArrayPropertyProps extends PrimitiveOrEnumPropertyBaseProps {
  readonly minOccurs?: number;
  readonly maxOccurs?: number;
}

/**
 * @beta
 */
export interface PrimitiveArrayPropertyProps extends ArrayPropertyProps {
  readonly typeName: string;
}

/**
 * @beta
 */
export interface StructArrayPropertyProps extends ArrayPropertyProps {
  readonly typeName: string;
}

/**
 * @beta
 */
export interface NavigationPropertyProps extends PropertyProps {
  readonly relationshipName: string;
  readonly direction: string;
}

/**
 * @beta
 */
export interface ConstantProps extends SchemaItemProps {
  readonly phenomenon: string;
  readonly definition: string;
  readonly numerator?: number;
  readonly denominator?: number;
}

/**
 * @beta
 */
export type SchemaItemFormatProps = SchemaItemProps & FormatProps;

/**
 * @beta
 */
export interface SchemaItemOverrideFormatProps extends SchemaItemFormatProps {
  readonly parent: string;
}

/**
 * @beta
 */
export interface InvertedUnitProps extends SchemaItemProps {
  readonly invertsUnit: string;
  readonly unitSystem: string;
}

/**
 * @beta
 */
export interface PhenomenonProps extends SchemaItemProps {
  readonly definition: string;
}

/**
 * @beta
 */
export type UnitSystemProps = SchemaItemProps;

/**
 * @beta
 */
export interface SchemaItemUnitProps extends SchemaItemProps {
  readonly phenomenon: string;
  readonly unitSystem: string;
  readonly definition: string;
  readonly numerator?: number;
  readonly denominator?: number;
  readonly offset?: number;
}
