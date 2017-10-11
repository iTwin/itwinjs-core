/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { ECSchemaInterface, ClassInterface, PropertyInterface, SchemaChildInterface } from "../../ECInterfaces/Interfaces";
import { ECVersion, ECClassModifier, ECName } from "../../ECObjects";
import { ICustomAttributeContainer, CustomAttributeSet } from "../CustomAttribute";

export abstract class SchemaChild implements SchemaChildInterface {
  public name: ECName;
  public schema?: ECName | ECSchemaInterface;
  public schemaVersion?: ECVersion;
  public description?: string;
  public label?: string;

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
}

export abstract class Class extends SchemaChild implements ICustomAttributeContainer, ClassInterface {
  public modifier: ECClassModifier;
  public baseClass?: string | ClassInterface;
  public properties: PropertyInterface[];
  public customAttributes: CustomAttributeSet;

  public fromJson(jsonObj: any): void {
    super.fromJson(jsonObj);

    if (jsonObj.modifier) {
      switch (jsonObj.modifier as string) {
        case "abstract":
          this.modifier = ECClassModifier.Abstract;
          break;
        default:
        case "none":
          this.modifier = ECClassModifier.None;
          break;
        case "sealed":
          this.modifier = ECClassModifier.Sealed;
          break;
      }
    }
  }
}
