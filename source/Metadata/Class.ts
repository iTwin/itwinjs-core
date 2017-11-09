/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { ClassInterface, MixinInterface, EntityClassInterface, PropertyInterface, CustomAttributeClassInterface } from "../Interfaces";
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
        const baseClass = this.schema.getChild<Class>(jsonObj.baseClass);

        if (!baseClass)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
        this.baseClass = baseClass;
      } else
        this.baseClass = jsonObj.baseClass;
    }
  }
}

/**
 *
 */
export class EntityClass extends Class implements EntityClassInterface {
  public mixins?: MixinInterface[];

  public fromJson(jsonObj: any): void {
    super.fromJson(jsonObj);

    const loadMixin = (mixinFullName: string) => {
      const tempMixin = this.schema.getChild<MixinInterface>(mixinFullName);
      if (!tempMixin)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

      if (!this.mixins)
        this.mixins = [];
      this.mixins.push(tempMixin);
    };

    if (jsonObj.mixin) {
      if (typeof(jsonObj.mixin) === "string") {
        loadMixin(jsonObj.mixin);
      } else if (Array.isArray(jsonObj.mixin)) {
        jsonObj.mixin.forEach((mixinName: string) => {
          loadMixin(mixinName);
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
  public appliesTo: string | EntityClassInterface;

  public fromJson(jsonObj: any): void {
    super.fromJson(jsonObj);

    if (jsonObj.appliesTo) {
      const tmpClass = this.schema.getChild<EntityClassInterface>(jsonObj.appliesTo);
      if (!tmpClass)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

      this.appliesTo = tmpClass;
    }
  }
}

/**
 *
 */
export class StructClass extends Class implements ClassInterface { }

/**
 *
 */
export class CustomAttributeClass extends Class implements CustomAttributeClassInterface {
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
