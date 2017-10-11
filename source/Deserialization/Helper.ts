/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { ECSchemaInterface } from "../ECInterfaces/Interfaces";
// import { SchemaChild } from "../Class";

/**
 * The purpose of this helper class is to properly order
 * the various ECObjects deserialization. For example, when deserializing an ECClass
 * most times all base class should be deserialized before the given class.
 *
 * The goal of the class is to remove the implementer of a a deserializer from having to know
 * and/or worry about if they ordered something properly.
 */
export default class DeserializationHelper {
  public static to<T extends ECSchemaInterface>(schemaObj: T, schemaJson: object | string): T {
    const jsonObj = typeof schemaJson === "string" ? JSON.parse(schemaJson) : schemaJson;

    // TODO : Load schema references first

    schemaObj.fromJson(jsonObj);

    // TODO: Load SchemaChildren
    // TODO: Load CustomAttributes

    return schemaObj;
  }

  // public static to<T extends SchemaChild>(obj: T, json: string): T {
  //   const jsonObj = JSON.parse(json);

  //   return obj;
  // }
}
