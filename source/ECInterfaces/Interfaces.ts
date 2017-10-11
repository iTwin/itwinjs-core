/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { ECVersion, ECName } from "../ECObjects";

export interface Deserializable {
  fromJson(obj: any): void;
  // toJson(): ECSchema;
}

export interface SchemaReference {
  name: string;
  vesrion: ECVersion;
}

export interface ECSchemaInterface extends Deserializable {
  references?: SchemaReference[] | ECSchemaInterface[];
  children?: SchemaChildInterface[];
}

export interface SchemaChildInterface extends Deserializable {
  schema?: ECName | ECSchemaInterface;
  schemaVersion?: ECVersion;
}

export interface ClassInterface extends SchemaChildInterface {
  baseClass?: string | ClassInterface; // string should be a ECFullName
  properties: PropertyInterface[];
}

export interface MixinInterface extends ClassInterface {
  appliesTo?: EntityClassInterface;
}

export interface EntityClassInterface extends ClassInterface {
  mixin?: MixinInterface;
}

export interface PropertyInterface extends Deserializable {
  category?: string | SchemaChildInterface;
}
