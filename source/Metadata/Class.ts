/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { SchemaInterface, ClassInterface, MixinInterface, EntityInterface, PropertyInterface, SchemaChildInterface } from "../ECInterfaces/Interfaces";
import { ECVersion, ECClassModifier, ECName } from "../ECObjects";
import { ICustomAttributeContainer, CustomAttributeSet } from "./CustomAttribute";
import { ECObjectsError, ECObjectsStatus } from "../Exception";

/**
 *
 */
export abstract class SchemaChild implements SchemaChildInterface {
  private _name: ECName;
  public schema?: string | SchemaInterface;
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
}

/**
 *
 */
export abstract class Class extends SchemaChild implements ICustomAttributeContainer, ClassInterface {
  public modifier: ECClassModifier;
  public baseClass?: string | ClassInterface;
  public properties?: PropertyInterface[];
  public customAttributes?: CustomAttributeSet;

  constructor(name: string, modifier?: ECClassModifier) {
    super(name);

    if (modifier)
      this.modifier = modifier;
    else
      this.modifier = ECClassModifier.None;
  }

  public createProperty(name: string) {
    // TODO
    if (!name)
      return;

    return;
  }

  public fromJson(jsonObj: any): void {
    super.fromJson(jsonObj);

    if (jsonObj.modifier) {
      switch (jsonObj.modifier as string) {
        case "abstract":
          this.modifier = ECClassModifier.Abstract;
          break;
        case "none":
          this.modifier = ECClassModifier.None;
          break;
        case "sealed":
          this.modifier = ECClassModifier.Sealed;
          break;
        default:
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `${this.name} has an invalid modifier, ${jsonObj.modifier}.`);
      }
    }

    if (jsonObj.baseClass) {
      if (typeof(jsonObj.baseClass) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The base class of ${this.name} is not a string type.`);

      if (this.schema && typeof(this.schema) !== "string") {
        const baseClass = this.schema.getClass(jsonObj.baseClass as string);
        if (baseClass)
          this.baseClass = baseClass as Class;
      } else
        this.baseClass = jsonObj.baseClass;
    }
  }
}

/**
 *
 */
export class EntityClass extends Class implements EntityInterface {
  public mixin?: string | MixinInterface;

  private loadMixin(mixinName: string): void {
    if (this.schema && typeof(this.schema) !== "string") {
      const mixin = this.schema.getClass(mixinName);
      if (mixin)
        this.mixin = mixin as MixinClass;
      else // If we cannot find the Mixin from the class, set the mixin to a string.
        this.mixin = mixinName;
    } else
      this.mixin = mixinName;
  }

  public fromJson(jsonObj: EntityClass): void {
    super.fromJson(jsonObj);

    if (jsonObj.mixin) {
      if (typeof(jsonObj.mixin) === "string") {
        this.loadMixin(jsonObj.mixin);
      } else if (Array.isArray(jsonObj.mixin)) {
        jsonObj.mixin.forEach((mixinName: string) => {
          this.loadMixin(mixinName);
        });
      } else
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Mixin on ECEntityClass ${this.name} is an invalid type. It must be of Json type string or an array of strings.`);
    }
  }
}

/**
 *
 */
export class MixinClass extends Class implements MixinInterface {
  public appliesTo: string | EntityInterface;

  public fromJson(jsonObj: any): void {
    if (!jsonObj.appliesTo)
      return;

    // TODO: Need to parse the full name and then check if the classs exists within a schema. If it does, try and get that class from the schema.
  }
}

/**
 *
 */
export class StructClass extends Class implements ClassInterface { }
