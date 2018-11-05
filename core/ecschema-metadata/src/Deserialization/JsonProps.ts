/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { StrengthDirection, StrengthType } from "./../ECObjects";
import { CustomAttribute } from "./../Metadata/CustomAttribute";

export type AnyPropertyProps = PrimitivePropertyProps | StructPropertyProps | PrimitiveArrayPropertyProps | StructArrayPropertyProps | NavigationPropertyProps;

export type AnyClassProps = EntityClassProps | MixinProps | CustomAttributeClassProps | RelationshipClassProps;
export type AnySchemaItemProps = AnyClassProps | EnumerationProps | KindOfQuantityProps | PropertyCategoryProps | UnitProps | InvertedUnitProps | ConstantProps | PhenomenonProps | FormatProps;

export interface SchemaProps {
  $schema: string;
  name: string;
  version: string;
  alias: string;
  label?: string;
  description?: string;
  references?: SchemaReferenceProps[];
  customAttributes?: CustomAttribute[];
  items?: {
    [key: string]: AnySchemaItemProps,
  };
}

export interface SchemaReferenceProps {
  name: string;
  version: string;
}

export interface SchemaItemProps {
  $schema?: string; // conditionally required
  schema?: string;  // conditionally required
  schemaVersion?: string;
  schemaItemType: string;
  label?: string;
  description?: string;
}

export interface ClassProps extends SchemaItemProps {
  modifier?: string;
  baseClass?: string;
  properties?: AnyPropertyProps[];
  customAttributes?: object[];
}

export interface EntityClassProps extends ClassProps {
  mixins?: string[];
}

export interface MixinProps extends ClassProps {
  appliesTo: string;
}

export interface CustomAttributeClassProps extends ClassProps {
  appliesTo: string;
}

export interface RelationshipClassProps extends ClassProps {
  strength: StrengthType;
  strengthDirection: StrengthDirection;
  source: RelationshipConstraintProps;
  target: RelationshipConstraintProps;
}

export interface RelationshipConstraintProps {
  multiplicity: string;
  roleLabel: string;
  polymorphic: boolean;
  abstractConstraint?: string;
  constraintClasses: string[];
  customAttributes?: object[];
}

export interface EnumerationProps extends SchemaItemProps {
  type: string;
  isStrict: boolean;
  enumerators: EnumeratorProps[];
}

export interface EnumeratorProps {
  name: string;
  value: string | number;
  label?: string;
  description?: string;
}

export interface KindOfQuantityProps extends SchemaItemProps {
  persistenceUnit: string;
  presentationUnits?: string[];
  relativeError: number;
}

export interface PropertyCategoryProps extends SchemaItemProps {
  priority: number;
}

export interface PropertyProps {
  name: string;
  type: string;
  description?: string;
  label?: string;
  isReadOnly?: boolean;
  category?: string;
  priority?: number;
  customAttributes?: CustomAttribute[];
  inherited?: boolean;
  kindOfQuantity?: string;
}

export interface PrimitiveOrEnumPropertyBaseProps extends PropertyProps {
  extendedTypeName?: string;
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
}
export interface PrimitivePropertyProps extends PrimitiveOrEnumPropertyBaseProps {
  typeName: string;
}

export interface StructPropertyProps extends PropertyProps {
  typeName: string;
}

export interface EnumerationPropertyProps extends PrimitiveOrEnumPropertyBaseProps {
  typeName: string;
}

export interface ArrayPropertyProps extends PrimitiveOrEnumPropertyBaseProps {
  minOccurs?: number;
  maxOccurs?: number;
}

export interface PrimitiveArrayPropertyProps extends ArrayPropertyProps {
  typeName: string;
}

export interface StructArrayPropertyProps extends ArrayPropertyProps {
  typeName: string;
}

export interface NavigationPropertyProps extends PropertyProps {
  relationshipName: string;
  direction: string;
}

export interface ConstantProps extends SchemaItemProps {
  phenomenon: string;
  definition: string;
  numerator?: number;
  denominator?: number;
}

export interface FormatProps extends SchemaItemProps {
  type: string;
  precision?: number;
  roundFactor?: number;
  minWidth?: number;
  showSignOption?: string;
  formatTraits?: string | string[];
  decimalSeparator?: string;
  thousandSeparator?: string;
  uomSeparator?: string;
  scientificType?: string; // conditionally required
  stationOffsetSize?: number; // conditionally required
  stationSeparator?: string;
  composite?: {
    spacer?: string;
    includeZero?: boolean;
    units?: Array<{
      name: string;
      label?: string;
    }>
  };
}

export interface InvertedUnitProps extends SchemaItemProps {
  invertsUnit: string;
  unitSystem: string;
}

export interface PhenomenonProps extends SchemaItemProps {
  definition: string;
}

export interface UnitProps extends SchemaItemProps {
  phenomenon: string;
  unitSystem: string;
  definition: string;
  numerator?: number;
  denominator?: number;
  offset?: number;
}
