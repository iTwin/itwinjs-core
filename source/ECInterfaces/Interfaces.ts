/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { ECVersion, ECName, ECClassModifier } from "../ECObjects";
import { DeserializableSchemaInterface, DeserializableClassInterface } from "./DeserializationInterfaces";

export interface SchemaKeyInterface {
  name: string;
  version: ECVersion;
}

export interface ReferencesInterface {
  name: string;
  version: string;
}

export interface SchemaInterface extends DeserializableSchemaInterface {
  schemaKey: SchemaKeyInterface;
  alias: string;
  label?: string;
  description?: string;
  references?: ReferencesInterface[];
  children?: SchemaChildInterface[];
}

export interface SchemaChildInterface {
  schema?: string | SchemaInterface;
  schemaVersion?: ECVersion;
  name: string;
  label?: string;
  description?: string;
}

export interface ClassInterface extends SchemaChildInterface {
  modifier: ECClassModifier;
  baseClass?: string | ClassInterface; // string should be a ECFullName
  properties?: PropertyInterface[];
}

export interface EntityInterface extends ClassInterface, DeserializableClassInterface {
  mixin?: string | MixinInterface; // string should be an ECFullName
}

export interface MixinInterface extends ClassInterface {
  appliesTo?: string | EntityInterface; // string should be an ECFullName
}

export interface RelationshipInterface extends ClassInterface {
  strength: string;
  strengthDirection: string;
  source: RelationshipConstraintInterface;
  target: RelationshipConstraintInterface;
}

export interface RelationshipConstraintInterface {
  multiplicity: string;
  roleLabel: string;
  polymorphic: boolean;
  abstractConstraint: string; // string should be an ECFullName
  customAttributes: object[];  // TODO: Fix this
  constraintClasses: EntityInterface[] | RelationshipInterface[];
}

export interface CustomAttributeInterface {
  appliesTo: string; // string should be a CustomAttributeContainerType
}

// export interface ECEnumeratio 

export interface PropertyInterface {

}
