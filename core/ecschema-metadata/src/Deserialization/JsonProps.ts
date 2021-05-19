/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Metadata
 */

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
export type AnySchemaItemProps = AnyClassProps | EnumerationProps | KindOfQuantityProps | PropertyCategoryProps | UnitProps | InvertedUnitProps | ConstantProps | PhenomenonProps | FormatProps;

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
}

/**
 * @beta
 */
export interface ClassProps extends SchemaItemProps {
  readonly modifier?: string;
  readonly baseClass?: string;
  readonly properties?: PropertyProps[];
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
export interface FormatProps extends SchemaItemProps {
  readonly type: string;
  readonly precision?: number;
  readonly roundFactor?: number;
  readonly minWidth?: number;
  readonly showSignOption?: string;
  readonly formatTraits?: string | string[];
  readonly decimalSeparator?: string;
  readonly thousandSeparator?: string;
  readonly uomSeparator?: string;
  readonly scientificType?: string; // conditionally required
  readonly stationOffsetSize?: number; // conditionally required
  readonly stationSeparator?: string;
  readonly composite?: {
    readonly spacer?: string;
    readonly includeZero?: boolean;
    readonly units: Array<{
      readonly name: string;
      readonly label?: string;
    }>;
  };
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
export interface UnitProps extends SchemaItemProps {
  readonly phenomenon: string;
  readonly unitSystem: string;
  readonly definition: string;
  readonly numerator?: number;
  readonly denominator?: number;
  readonly offset?: number;
}
