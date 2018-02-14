/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { ECVersion, SchemaChildKey, SchemaKey, SchemaChildType } from "../ECObjects";
import { SchemaChildVisitor } from "../Interfaces";
import Schema from "./Schema";

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
    if (jsonObj.name) this.name = jsonObj.name;
    if (jsonObj.description) this.description = jsonObj.description;
    if (jsonObj.label) this.label = jsonObj.label;

    if (jsonObj.schema) {
      if (!this.key.schemaKey)
        this.key.schemaKey = new SchemaKey();
      this.key.schemaKey.name = jsonObj.schema;
    }

    if (jsonObj.schemaVersion) {
      if (!this.key.schemaKey)
        this.key.schemaKey = new SchemaKey();

      if (!this.key.schemaKey.version)
        this.key.schemaKey.version = new ECVersion();

      this.key.schemaKey.version.fromString(jsonObj.version);
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
