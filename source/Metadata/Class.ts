/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { ClassInterface, MixinInterface, EntityClassInterface, PropertyInterface, CustomAttributeClassInterface, RelationshipClassInterface, RelationshipConstraintInterface } from "../Interfaces";
import { ECClassModifier, CustomAttributeContainerType, RelationshipMultiplicity, RelationshipEnd, StrengthDirection, StrengthType,
  parseCustomAttributeContainerType, parseClassModifier, parseStrength, parseStrengthDirection } from "../ECObjects";
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

/**
 *
 */
export class RelationshipClass extends Class implements RelationshipClassInterface {
  public strength: StrengthType;
  public strengthDirection: StrengthDirection;
  public readonly source: RelationshipConstraintInterface;
  public readonly target: RelationshipConstraintInterface;

  constructor(name: string, strength?: StrengthType, strengthDirection?: StrengthDirection, modifier?: ECClassModifier) {
    super(name, modifier);

    if (strength) this.strength = strength; else this.strength = StrengthType.Referencing;
    if (strengthDirection) this.strengthDirection = strengthDirection; else this.strengthDirection = StrengthDirection.Forward;

    this.source = new RelationshipConstraint(this, RelationshipEnd.Source);
    this.target = new RelationshipConstraint(this, RelationshipEnd.Target);
  }

  public fromJson(jsonObj: any): void {
    super.fromJson(jsonObj);

    if (jsonObj.strength) this.strength = parseStrength(jsonObj.strength);
    if (jsonObj.strengthDirection) this.strengthDirection = parseStrengthDirection(jsonObj.strengthDirection);
  }
}

/**
 *
 */
export class RelationshipConstraint implements RelationshipConstraintInterface {
  private _abstractConstraint: EntityClassInterface | RelationshipClassInterface;
  public relationshipClass: RelationshipClassInterface;
  public relationshipEnd: RelationshipEnd;
  public multiplicity: RelationshipMultiplicity;
  public polymorphic: boolean;
  public roleLabel: string;
  public constraintClasses: EntityClassInterface[] | RelationshipClassInterface[];

  constructor(relClass: RelationshipClass, relEnd: RelationshipEnd) {
    this.relationshipEnd = relEnd;
    this.polymorphic = false;
    this.multiplicity = RelationshipMultiplicity.zeroOne;
    this.relationshipClass = relClass;
  }

  get abstractConstraint(): EntityClassInterface | RelationshipClassInterface {
    if (this._abstractConstraint)
      return this._abstractConstraint;

    if (this.constraintClasses && this.constraintClasses.length === 1)
      return this.constraintClasses[0];

    return this._abstractConstraint;
  }

  set abstractConstraint(abstractConstraint: EntityClassInterface | RelationshipClassInterface) {
    this._abstractConstraint = abstractConstraint;
  }

  get isSource() { return this.relationshipEnd === RelationshipEnd.Source; }

  public addClass(constraint: EntityClassInterface | RelationshipClassInterface): void {
    const areEntityConstraints = undefined !== this.constraintClasses as EntityClassInterface[]

    if (areEntityConstraints && (undefined === constraint as EntityClassInterface))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

    // TODO: Handle relationship constraints

    if (!this.constraintClasses)
      this.constraintClasses = [];

    if (areEntityConstraints)
      (this.constraintClasses as EntityClassInterface[]).push(constraint as EntityClassInterface);
    else
      (this.constraintClasses as RelationshipClassInterface[]).push(constraint as RelationshipClassInterface);

  }

  public fromJson(jsonObj: any): void {
    if (jsonObj.roleLabel) this.roleLabel = jsonObj.roleLabel;
    if (jsonObj.polymorphic) this.polymorphic = jsonObj.polymorphic;

    if (jsonObj.multiplicity) {
      const multTmp = RelationshipMultiplicity.fromString(jsonObj.multiplicity);
      if (!multTmp)
        throw new ECObjectsError(ECObjectsStatus.InvalidMultiplicity, ``);
      this.multiplicity = multTmp;
    }

    if (jsonObj.abstractConstraint) {
      if (typeof(jsonObj.abstractConstraint) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

      if (this.relationshipClass.schema && typeof(this.relationshipClass.schema) !== "string") {
        const tempAbstractConstraint = this.relationshipClass.schema.getChild<ClassInterface>(jsonObj.abstractConstraint);
        if (!tempAbstractConstraint)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

        this.abstractConstraint = tempAbstractConstraint;
      }
    }

    if (jsonObj.constraintClasses) {
      if (!Array.isArray(jsonObj.constraintClasses))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
      jsonObj.constraintClasses.forEach((constraintClass: string) => {
        if (this.relationshipClass.schema && typeof(this.relationshipClass.schema) !== "string") {
          const tempConstraintClass = this.relationshipClass.schema.getChild<ClassInterface>(constraintClass);
          if (!tempConstraintClass)
            throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

          this.addClass(tempConstraintClass);
        }
      });
    }
  }
}
