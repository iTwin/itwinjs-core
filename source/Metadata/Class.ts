/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { ClassInterface, MixinInterface, EntityInterface, PropertyInterface, CustomAttributeInterface } from "../ECInterfaces/Interfaces";
import { ECClassModifier, CustomAttributeContainerType, parseCustomAttributeContainerType
, parseClassModifier } from "../ECObjects";
import { ICustomAttributeContainer, CustomAttributeSet } from "./CustomAttribute";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import SchemaChild from "./SchemaChild";

/**
 *
 */
export abstract class Class extends SchemaChild implements ICustomAttributeContainer, ClassInterface {
  public modifier: ECClassModifier;
  public baseClass?: ClassInterface;
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

    if (jsonObj.modifier)
      this.modifier = parseClassModifier(jsonObj.modifier);

    if (jsonObj.baseClass) {
      if (typeof(jsonObj.baseClass) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The base class of ${this.name} is not a string type.`);

      if (this.schema && typeof(this.schema) !== "string") {
        const baseClass = this.schema.getChild<EntityClass>(jsonObj.baseClass as string);
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
      const mixin = this.schema.getChild<MixinClass>(mixinName);
      if (mixin)
        this.mixin = mixin as MixinClass;
      else // If we cannot find the Mixin from the class, set the mixin to a string.
        this.mixin = mixinName;
    } else
      this.mixin = mixinName;
  }

  public fromJson(jsonObj: any): void {
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
    super.fromJson(jsonObj);

    if (!jsonObj.appliesTo)
      return;

    
  }
}

/**
 *
 */
export class StructClass extends Class implements ClassInterface { }

/**
 *
 */
export class CustomAttributeClass extends Class implements CustomAttributeInterface {
  public containerType: CustomAttributeContainerType;

  public fromJson(jsonObj: any): void {
    super.fromJson(jsonObj);

    if (!jsonObj.appliesTo)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Custom Attribute class ${this.name} is missing the required 'appliesTo' property.`);
    if (typeof(jsonObj.appliesTo) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

    this.containerType = parseCustomAttributeContainerType(jsonObj.appliesTo);
  }
}
