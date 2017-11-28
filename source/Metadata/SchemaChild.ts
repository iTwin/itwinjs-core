/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { SchemaInterface, SchemaChildInterface } from "../Interfaces";
import { ECVersion, ECName } from "../ECObjects";

/**
 * An abstract class that supplies all of the common parts of a SchemaChild.
 */
export default abstract class SchemaChild implements SchemaChildInterface {
  private _name: ECName;
  public schema: SchemaInterface;
  public schemaVersion?: ECVersion;
  public description?: string;
  public label?: string;

  constructor(name: string) {
    this.name = name;
  }

  get name() { return this._name.name; }
  set name(name: string) {
    this._name = new ECName(name);
  }

  public fromJson(jsonObj: any): void {
    if (jsonObj.name) this.name = jsonObj.name;
    if (jsonObj.description) this.description = jsonObj.description;
    if (jsonObj.label) this.label = jsonObj.label;

    if (jsonObj.schemaVersion) {
      if (!this.schemaVersion)
        this.schemaVersion = new ECVersion();
      this.schemaVersion.fromString(jsonObj.version);
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
