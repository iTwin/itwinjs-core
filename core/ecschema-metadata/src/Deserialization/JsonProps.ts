/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { CustomAttribute } from "./../Metadata/CustomAttribute";

export type AnyPropertyProps = PrimitivePropertyProps | StructPropertyProps | PrimitiveArrayPropertyProps | StructArrayPropertyProps | NavigationPropertyProps;

export type AnyClassProps = EntityClassProps | MixinProps | CustomAttributeClassProps | RelationshipClassProps;
export type AnySchemaItemProps = AnyClassProps | EnumerationProps | KindOfQuantityProps | PropertyCategoryProps | UnitProps | InvertedUnitProps | ConstantProps | PhenomenonProps | FormatProps;

export interface SchemaProps {
  readonly $schema: string;
  readonly name: string;
  readonly version: string;
  readonly alias: string;
  readonly label?: string;
  readonly description?: string;
  readonly references?: SchemaReferenceProps[];
  readonly customAttributes?: CustomAttribute[];
}

export interface SchemaReferenceProps {
  readonly name: string;
  readonly version: string;
}

export interface SchemaItemProps {
  // NEEDSWORK: Still need to clarify how single-item deserialization works...
  readonly schema?: string;  // conditionally required
  readonly schemaVersion?: string;
  readonly schemaItemType?: string;
  readonly label?: string;
  readonly description?: string;
}

export interface ClassProps extends SchemaItemProps {
  readonly modifier?: string;
  readonly baseClass?: string;
  readonly customAttributes?: object[];
}

export interface EntityClassProps extends ClassProps {
  readonly mixins?: string[];
}

export interface MixinProps extends ClassProps {
  readonly appliesTo: string;
}

export type StructClassProps = ClassProps;

export interface CustomAttributeClassProps extends ClassProps {
  readonly appliesTo: string;
}

export interface RelationshipClassProps extends ClassProps {
  readonly strength: string;
  readonly strengthDirection: string;
  readonly source: RelationshipConstraintProps;
  readonly target: RelationshipConstraintProps;
}

export interface RelationshipConstraintProps {
  readonly multiplicity: string;
  readonly roleLabel: string;
  readonly polymorphic: boolean;
  readonly abstractConstraint?: string;
  readonly constraintClasses: string[];
  readonly customAttributes?: object[];
}

export interface EnumerationProps extends SchemaItemProps {
  readonly type: string;
  readonly isStrict: boolean;
  readonly enumerators: EnumeratorProps[];
}

export interface EnumeratorProps {
  readonly name: string;
  readonly value: string | number;
  readonly label?: string;
  readonly description?: string;
}

export interface KindOfQuantityProps extends SchemaItemProps {
  readonly persistenceUnit: string;
  readonly presentationUnits?: string | string[];
  readonly relativeError: number;
}

export interface PropertyCategoryProps extends SchemaItemProps {
  readonly priority: number;
}

export interface PropertyProps {
  readonly name: string;
  readonly type: string;
  readonly description?: string;
  readonly label?: string;
  readonly isReadOnly?: boolean;
  readonly category?: string;
  readonly priority?: number;
  readonly customAttributes?: CustomAttribute[];
  readonly inherited?: boolean;
  readonly kindOfQuantity?: string;
}

export interface PrimitiveOrEnumPropertyBaseProps extends PropertyProps {
  readonly extendedTypeName?: string;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly minValue?: number;
  readonly maxValue?: number;
}
export interface PrimitivePropertyProps extends PrimitiveOrEnumPropertyBaseProps {
  readonly typeName: string;
}

export interface StructPropertyProps extends PropertyProps {
  readonly typeName: string;
}

export interface EnumerationPropertyProps extends PrimitiveOrEnumPropertyBaseProps {
  readonly typeName: string;
}

export interface ArrayPropertyProps extends PrimitiveOrEnumPropertyBaseProps {
  readonly minOccurs?: number;
  readonly maxOccurs?: number;
}

export interface PrimitiveArrayPropertyProps extends ArrayPropertyProps {
  readonly typeName: string;
}

export interface StructArrayPropertyProps extends ArrayPropertyProps {
  readonly typeName: string;
}

export interface NavigationPropertyProps extends PropertyProps {
  readonly relationshipName: string;
  readonly direction: string;
}

export interface ConstantProps extends SchemaItemProps {
  readonly phenomenon: string;
  readonly definition: string;
  readonly numerator?: number;
  readonly denominator?: number;
}

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
    }>
  };
}

export interface InvertedUnitProps extends SchemaItemProps {
  readonly invertsUnit: string;
  readonly unitSystem: string;
}

export interface PhenomenonProps extends SchemaItemProps {
  readonly definition: string;
}

export type UnitSystemProps = SchemaItemProps;

export interface UnitProps extends SchemaItemProps {
  readonly phenomenon: string;
  readonly unitSystem: string;
  readonly definition: string;
  readonly numerator?: number;
  readonly denominator?: number;
  readonly offset?: number;
}
