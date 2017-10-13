/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

export interface DeserializableItem {
  fromJson(obj: any): void;
  // toJson(): ECSchema;
}

export interface DeserializableSchemaInterface extends DeserializableItem {
  getClass(name: string): DeserializableClassInterface | undefined;
  createEntityClass(name: string): any;
  createMixinClass(name: string): any;
  createStructClass(name: string): any;
  // createCustomAttributeClass(ecClassJson: string): void;
}

export interface DeserializableClassInterface extends DeserializableItem {
  createProperty(name: string): any;
  // createPropertyFromJson(ecPropertyJson: DeserializableItem): void;
}
