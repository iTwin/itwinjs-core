/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { SchemaChildKey, SchemaChildType } from "../ECObjects";
import { SchemaChildVisitor } from "../Interfaces";
import Schema from "./Schema";
import { ECObjectsError, ECObjectsStatus } from "../Exception";

/**
 * An abstract class that supplies all of the common parts of a SchemaChild.
 */
export default abstract class SchemaChild {
  public readonly schema: Schema;
  public key: SchemaChildKey;
  public description?: string;
  public label?: string;

  constructor(schema: Schema, name: string) {
    this.key = new SchemaChildKey(name);
    this.schema = schema;
  }

  public get type(): SchemaChildType { return this.key.type; }

  get name() { return this.key.name; }
  set name(name: string) { this.key.name = name; }

  get fullName() { return this.key.schemaKey ? `${this.key.schemaKey}.${this.name}` : this.name; }

  public async fromJson(jsonObj: any): Promise<void> {
    if (undefined !== jsonObj.name) {
      if (typeof(jsonObj.name) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaChild ${this.name} has an invalid 'name' attribute. It should be of type 'string'.`);

      if (jsonObj.name.toLowerCase() !== this.name.toLowerCase())
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
    }

    if (undefined !== jsonObj.description) {
      if (typeof(jsonObj.description) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaChild ${this.name} has an invalid 'description' attribute. It should be of type 'string'.`);
      this.description = jsonObj.description;
    }

    if (undefined !== jsonObj.label) {
      if (typeof(jsonObj.label) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaChild ${this.name} has an invalid 'label' attribute. It should be of type 'string'.`);
      this.label = jsonObj.label;
    }

    if (undefined !== jsonObj.schema) {
      if (typeof(jsonObj.schema) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaChild ${this.name} has an invalid 'schema' attribute. It should be of type 'string'.`);

      if (jsonObj.schema.toLowerCase() !== this.schema.name.toLowerCase())
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
    }

    if (undefined !== jsonObj.schemaVersion) {
      if (typeof(jsonObj.schemaVersion) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaChild ${this.name} has an invalid 'schemaVersion' attribute. It should be of type 'string'.`);

      if (jsonObj.schemaVersion !== this.key.schemaKey.version.toString())
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
    }
  }

  /**
   * Parses the given full name, {schemaName}.{schemaChildName}, into two separate strings.
   * If the name is not a string with a '.' in it than the second string in the tuple will be the name provided.
   * @param fullName The full name to be parsed.
   */
  public static parseFullName(fullName: string): [string, string] {
    const matches = /^([a-zA-Z_.]+[a-zA-Z0-9_.]*)\.([a-zA-Z_.]+[a-zA-Z0-9_.]*)$/.exec(fullName);

    // The first match will be the full string match, the second two will be the two groups
    if (matches === null || matches.length !== 3)
      return ["", fullName];

    return [matches[1], matches[2]];
  }

  public abstract async accept(visitor: SchemaChildVisitor): Promise<void>;
}
