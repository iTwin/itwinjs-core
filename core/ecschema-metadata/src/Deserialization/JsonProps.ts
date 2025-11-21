/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Metadata
 */

import { FormatDefinition, FormatProps, UnitSystemKey } from "@itwin/core-quantity";

/**
 * @public @preview
 */
export type AnyPropertyProps =
  | PrimitivePropertyProps
  | StructPropertyProps
  | PrimitiveArrayPropertyProps
  | StructArrayPropertyProps
  | NavigationPropertyProps;
/**
 * @public @preview
 */
export type AnyClassProps =
  | EntityClassProps
  | MixinProps
  | CustomAttributeClassProps
  | RelationshipClassProps;
/**
 * @public @preview
 */
export type AnySchemaItemProps =
  | AnyClassProps
  | EnumerationProps
  | KindOfQuantityProps
  | PropertyCategoryProps
  | SchemaItemUnitProps
  | InvertedUnitProps
  | ConstantProps
  | PhenomenonProps
  | SchemaItemFormatProps
  | SchemaItemOverrideFormatProps;

/**
 * @public @preview
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
  readonly ecSpecMajorVersion?: number;
  readonly ecSpecMinorVersion?: number;
}

/**
 * JSON Object interface used to deserialize into a [[SchemaKey]].
 * @public @preview
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
 * @public @preview
 */
export interface SchemaReferenceProps {
  readonly name: string;
  readonly version: string;
}

/**
 * @public @preview
 */
export interface SchemaItemProps {
  // NEEDSWORK: Still need to clarify how single-item deserialization works...
  readonly $schema?: string;
  readonly schema?: string; // conditionally required
  readonly schemaVersion?: string;
  readonly name?: string;
  readonly schemaItemType?: string;
  readonly label?: string;
  readonly description?: string;
  readonly customAttributes?: Array<{ [value: string]: any }>;
  readonly originalECSpecMajorVersion?: number;
  readonly originalECSpecMinorVersion?: number;
}

/**
 * @public @preview
 */
export interface ClassProps extends SchemaItemProps {
  readonly modifier?: string;
  readonly baseClass?: string;
  readonly properties?: AnyPropertyProps[];
}

/**
 * @public @preview
 */
export interface EntityClassProps extends ClassProps {
  readonly mixins?: string[];
}

/**
 * @public @preview
 */
export interface MixinProps extends ClassProps {
  readonly appliesTo: string;
}

/**
 * @public @preview
 */
export type StructClassProps = ClassProps;

/**
 * @public @preview
 */
export interface CustomAttributeClassProps extends ClassProps {
  /**
   * Can be any combination of the [CustomAttributeContainerType]$(docs/bis/ec/customattribute-container-types.md) string values
   * separated by commas.
   */
  readonly appliesTo: string;
}

/**
 * @public @preview
 */
export interface RelationshipClassProps extends ClassProps {
  readonly strength: string;
  readonly strengthDirection: string;
  readonly source: RelationshipConstraintProps;
  readonly target: RelationshipConstraintProps;
}

/**
 * @public @preview
 */
export interface RelationshipConstraintProps {
  readonly multiplicity: string;
  readonly roleLabel: string;
  readonly polymorphic: boolean;
  readonly abstractConstraint?: string;
  readonly constraintClasses: string[];
  readonly customAttributes?: Array<{ [value: string]: any }>;
}

/**
 * @public @preview
 */
export interface EnumerationProps extends SchemaItemProps {
  readonly type: string;
  readonly isStrict: boolean;
  readonly enumerators: EnumeratorProps[];
}

/**
 * @public @preview
 */
export interface EnumeratorProps {
  readonly name: string;
  readonly value: string | number;
  readonly label?: string;
  readonly description?: string;
}

/**
 * @public @preview
 */
export interface KindOfQuantityProps extends SchemaItemProps {
  readonly persistenceUnit: string;
  readonly presentationUnits?: string | string[];
  readonly relativeError: number;
}

/**
 * @public @preview
 */
export interface PropertyCategoryProps extends SchemaItemProps {
  readonly priority: number;
}

/**
 * @public @preview
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
 * @public @preview
 */
export interface PrimitiveOrEnumPropertyBaseProps extends PropertyProps {
  readonly extendedTypeName?: string;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly minValue?: number;
  readonly maxValue?: number;
}

/**
 * @public @preview
 */
export interface PrimitivePropertyProps
  extends PrimitiveOrEnumPropertyBaseProps {
  readonly typeName: string;
}

/**
 * @public @preview
 */
export interface StructPropertyProps extends PropertyProps {
  readonly typeName: string;
}

/**
 * @public @preview
 */
export interface EnumerationPropertyProps
  extends PrimitiveOrEnumPropertyBaseProps {
  readonly typeName: string;
}

/**
 * @public @preview
 */
export interface ArrayPropertyProps extends PrimitiveOrEnumPropertyBaseProps {
  readonly minOccurs?: number;
  readonly maxOccurs?: number;
}

/**
 * @public @preview
 */
export interface PrimitiveArrayPropertyProps extends ArrayPropertyProps {
  readonly typeName: string;
}

/**
 * @public @preview
 */
export interface StructArrayPropertyProps extends ArrayPropertyProps {
  readonly typeName: string;
}

/**
 * @public @preview
 */
export interface NavigationPropertyProps extends PropertyProps {
  readonly relationshipName: string;
  readonly direction: string;
}

/**
 * @public @preview
 */
export interface ConstantProps extends SchemaItemProps {
  readonly phenomenon: string;
  readonly definition: string;
  readonly numerator?: number;
  readonly denominator?: number;
}

/**
 * @public @preview
 */
export type SchemaItemFormatProps = SchemaItemProps & FormatProps;

/**
 * This interface defines properties necessary to support persistence of a set of formats.
 * @beta
 */
export interface FormatSet {
  /** The unique name identifier for this format set. */
  name: string;
  /** The display label for this format set. */
  label: string;
  /** The description for this format set. */
  description?: string;
  /** A [UnitSystemKey]($quantity) that determines the unit system for this format set. */
  unitSystem: UnitSystemKey;
  /** 
   * A mapping of kind of quantity identifiers to their corresponding format properties.
   * When a format is a [FormatDefinition]($quantity), it defines the complete format specification.
   * When a format is a string, it references another kindOfQuantityId to map one format to another.
   */
  formats: { [kindOfQuantityId: string]: FormatDefinition | string };
}

/**
 * @public @preview
 */
export interface SchemaItemOverrideFormatProps extends SchemaItemFormatProps {
  readonly parent: string;
}

/**
 * @public @preview
 */
export interface InvertedUnitProps extends SchemaItemProps {
  readonly invertsUnit: string;
  readonly unitSystem: string;
}

/**
 * @public @preview
 */
export interface PhenomenonProps extends SchemaItemProps {
  readonly definition: string;
}

/**
 * @public @preview
 */
export type UnitSystemProps = SchemaItemProps;

/**
 * @public @preview
 */
export interface SchemaItemUnitProps extends SchemaItemProps {
  readonly phenomenon: string;
  readonly unitSystem: string;
  readonly definition: string;
  readonly numerator?: number;
  readonly denominator?: number;
  readonly offset?: number;
}
