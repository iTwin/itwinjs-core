/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { SchemaInterface, SchemaChildInterface } from "Interfaces";
import { ECVersion, SchemaChildKey, SchemaKey } from "ECObjects";
import { SchemaContext } from "Context";
import { ECObjectsError, ECObjectsStatus } from "Exception";

/**
 * An abstract class that supplies all of the common parts of a SchemaChild.
 */
export default abstract class SchemaChild implements SchemaChildInterface {
  // This is a pointer back to the parent schema
  private _schema?: SchemaInterface;
  public key: SchemaChildKey;
  public description?: string;
  public label?: string;

  constructor(name: string) {
    this.key = new SchemaChildKey(name);
  }

  get name() { return this.key.name; }
  set name(name: string) { this.key.name = name; }

  /**
   * Returns the schema containing this SchemaChild.
   *
   * If the Schema has already been linked to the schema A SchemaContext is necessary if the Schema is undefined currenhas not been added
   * to its
   * @param context If provided will be used to get the schema
   */
  public getSchema(context?: SchemaContext): SchemaInterface | undefined {
    if (this._schema)
      return this._schema;

    if (context && this.key.schema)
      return context.locateSchemaSync(this.key.schema as SchemaKey);

    return this._schema;
  }

  public setSchema(schema: SchemaInterface) {
    // TODO: Need to validate that the provided schema matches whatever the existing SchemaKey says.

    if (this._schema && this._schema !== schema)
      throw new ECObjectsError(ECObjectsStatus.DuplicateSchema, `This schemaChild ${this.name} is already contained within a schema.`);
    this._schema = schema;
  }

  get schema() { return this._schema; }

  get fullName() { return this.key.schema ? `${this.key.schema}.${this.name}` : this.name; }

  public fromJson(jsonObj: any): void {
    if (jsonObj.name) this.name = jsonObj.name;
    if (jsonObj.description) this.description = jsonObj.description;
    if (jsonObj.label) this.label = jsonObj.label;

    if (jsonObj.schema) {
      if (!this.key.schema)
        this.key.schema = new SchemaKey();
      this.key.schema.name = jsonObj.schema;
    }

    if (jsonObj.schemaVersion) {
      if (!this.key.schema)
        this.key.schema = new SchemaKey();

      if (!this.key.schema.version)
        this.key.schema.version = new ECVersion();

      this.key.schema.version.fromString(jsonObj.version);
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
}
