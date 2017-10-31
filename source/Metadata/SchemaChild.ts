/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { SchemaInterface, SchemaChildInterface } from "../Interfaces";
import { ECVersion, ECName } from "../ECObjects";

/**
 *
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
   * @param fullName The full name to be parsed.
   */
  public static parseFullName(fullName: string): [string, string] {
    const matches = fullName.match("^([a-zA-Z_.]+[a-zA-Z0-9_.]*)\.([a-zA-Z_.]+[a-zA-Z0-9_.]*)$");
    if (matches === null) return ["", ""];

    return ["", ""];
  }
}
