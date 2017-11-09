/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { ClassInterface, MixinInterface, EntityInterface, PropertyInterface, CustomAttributeInterface } from "../Interfaces";
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

      const [schemaName, baseClassName] = SchemaChild.parseFullName(jsonObj.baseClass);
      // Try to find the base class in the containing schema or within one of it's reference schemas
      if (this.schema && typeof(this.schema) !== "string") {
        let baseClass;
        if (this.schema.schemaKey.name.toLowerCase() === schemaName.toLowerCase())
          baseClass = this.schema.getChild<EntityClass>(baseClassName);
        else {
          const refSchema = this.schema.getReference(schemaName);
          if (!refSchema)
            throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The base class of ${this.name} is not in the schema or any referenced schemas.`);

          baseClass = refSchema.getChild<Class>(baseClassName);
        }

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
  public mixins?: MixinInterface[];

  private loadMixin(mixinFullName: string): void {
    const [schemaName, mixinName] = SchemaChild.parseFullName(mixinFullName);

    if (this.schema && typeof(this.schema) !== "string") {
      let mixin;
      if (this.schema.schemaKey.name.toLowerCase() === schemaName.toLowerCase())
        mixin = this.schema.getChild<EntityClass>(mixinName);
      else {
        const refSchema = this.schema.getReference(schemaName);
        if (!refSchema)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The base class of ${this.name} is not in the schema or any referenced schemas.`);

        mixin = refSchema.getChild<Class>(mixinName);
      }

      if (!mixin)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

      if (!this.mixins)
        this.mixins = [];
      this.mixins.push(mixin);
    }
    // TODO need to handle the case if the schema isn't here
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

    if (jsonObj.appliesTo) {
      const tmpClass = this.schema.getChild<EntityInterface>(jsonObj.appliesTo);
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
