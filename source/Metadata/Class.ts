/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { ECClassInterface, MixinInterface, EntityClassInterface, PropertyInterface, CustomAttributeClassInterface, RelationshipClassInterface,
  RelationshipConstraintInterface, NavigationPropertyInterface, PrimitivePropertyInterface, PrimitiveArrayPropertyInteface, SchemaChildInterface,
  StructPropertyInterface, StructArrayPropertyInterface, SchemaInterface } from "../Interfaces";
import { ECClassModifier, CustomAttributeContainerType, RelationshipMultiplicity, RelationshipEnd, RelatedInstanceDirection, StrengthType,
  parseCustomAttributeContainerType, parseClassModifier, parseStrength, parseStrengthDirection, PrimitiveType, parsePrimitiveType, SchemaChildType } from "../ECObjects";
import { ICustomAttributeContainer, CustomAttributeSet } from "./CustomAttribute";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import SchemaChild from "./SchemaChild";
import { NavigationProperty, PrimitiveProperty, PrimitiveArrayProperty, StructProperty, StructArrayProperty } from "./Property";

/**
 * A common abstract class for all of the ECClass types.
 */
export abstract class ECClass extends SchemaChild implements ICustomAttributeContainer, ECClassInterface {
  public modifier: ECClassModifier;
  public baseClass?: ECClassInterface;
  public properties?: PropertyInterface[];
  public customAttributes?: CustomAttributeSet;

  constructor(name: string, modifier?: ECClassModifier) {
    super(name);

    if (modifier)
      this.modifier = modifier;
    else
      this.modifier = ECClassModifier.None;
  }

  /**
   * Searches, case-insensitive, for a local ECProperty with the name provided.
   * @param name
   */
  public getProperty<T extends PropertyInterface>(name: string, includeInherited: boolean = false): T | undefined {
    let foundProp;

    if (this.properties) {
      foundProp = this.properties.find((prop) => prop.name.toLowerCase() === name.toLowerCase()) as T;
      if (foundProp)
        return foundProp;
    }

    if (includeInherited)
      return this.getInheritedProperty(name);

    return undefined;
  }

  /**
   * Searches the base class, if one exists, for the property with the name provided.
   * @param name
   */
  public getInheritedProperty<T extends PropertyInterface>(name: string): T | undefined {
    let inheritedProperty;

    if (this.baseClass) {
      inheritedProperty = this.baseClass.getProperty(name);
      if (!inheritedProperty)
        return inheritedProperty;
    }

    return inheritedProperty;
  }

  /**
   * Creates a PrimitiveECProperty with the given name and type
   * @param name The name of property to create.
   * @param type The type of the primitive property. If it is in string form it will be parsed as a PrimitiveType.
   * @throws ECObjectsStatus DuplicateProperty: thrown if a property with the same name already exists in the class.
   */
  public createPrimitiveProperty(name: string, type?: string | PrimitiveType): PrimitivePropertyInterface {
    if (this.getProperty(name))
      throw new ECObjectsError(ECObjectsStatus.DuplicateProperty, `An ECProperty with the name ${name} already exists in the class ${this.name}.`);

    let correctType: PrimitiveType | undefined;
    if (type && typeof(type) === "string")
      correctType = parsePrimitiveType(type);
    else
      correctType = type as PrimitiveType | undefined;

    const primProp = new PrimitiveProperty(name, correctType);

    if (!this.properties)
      this.properties = [];
    this.properties.push(primProp);

    return primProp;
  }

  /**
   *
   * @param name
   * @param type
   */
  public createPrimitiveArrayProperty(name: string, type?: string | PrimitiveType): PrimitiveArrayPropertyInteface {
    if (this.getProperty(name))
      throw new ECObjectsError(ECObjectsStatus.DuplicateProperty, `An ECProperty with the name ${name} already exists in the class ${this.name}.`);

    let correctType: PrimitiveType | undefined;
    if (type && typeof(type) === "string")
      correctType = parsePrimitiveType(type);
    else
      correctType = type as PrimitiveType | undefined;

    const primArrProp = new PrimitiveArrayProperty(name, correctType);

    if (!this.properties)
      this.properties = [];
    this.properties.push(primArrProp);

    return primArrProp;
  }

  /**
   *
   * @param name
   * @param type
   */
  public createStructProperty(name: string, type: string | SchemaChildInterface): StructPropertyInterface {
    if (this.getProperty(name))
      throw new ECObjectsError(ECObjectsStatus.DuplicateProperty, `An ECProperty with the name ${name} already exists in the class ${this.name}.`);

    let correctType: StructClass | undefined;
    if (typeof(type) === "string" && this.schema) {
      correctType = this.schema.getChild<StructClass>(type);
    } else
      correctType = type as StructClass;

    if (!correctType)
      throw new ECObjectsError(ECObjectsStatus.ECOBJECTS_ERROR_BASE, ``);

    const structProp = new StructProperty(name, correctType);

    if (!this.properties)
      this.properties = [];
    this.properties.push(structProp);

    return structProp;
  }

  /**
   *
   * @param name
   * @param type
   */
  public createStructArrayProperty(name: string, type: string | SchemaChildInterface): StructArrayPropertyInterface {
    if (this.getProperty(name))
      throw new ECObjectsError(ECObjectsStatus.DuplicateProperty, `An ECProperty with the name ${name} already exists in the class ${this.name}.`);

    let correctType: StructClass | undefined;
    if (typeof(type) === "string" && this.schema) {
      correctType = this.schema.getChild<StructClass>(type);
    } else
      correctType = type as StructClass;

    if (!correctType)
      throw new ECObjectsError(ECObjectsStatus.ECOBJECTS_ERROR_BASE, ``);

    const structProp = new StructArrayProperty(name, correctType);

    if (!this.properties)
      this.properties = [];
    this.properties.push(structProp);

    return structProp;
  }

  /**
   *
   * @param jsonObj
   */
  public fromJson(jsonObj: any): void {
    super.fromJson(jsonObj);

    if (jsonObj.modifier)
      this.modifier = parseClassModifier(jsonObj.modifier);

    if (jsonObj.baseClass) {
      if (typeof(jsonObj.baseClass) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The base class of ${this.name} is not a string type.`);

      if (this.schema && typeof(this.schema) !== "string") {
        const baseClass = this.schema.getChild<ECClass>(jsonObj.baseClass);

        if (!baseClass)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
        this.baseClass = baseClass;
      } else
        this.baseClass = jsonObj.baseClass;
    }
  }
}

/**
 * A Typescript class representation of an ECEntityClass.
 */
export class EntityClass extends ECClass implements EntityClassInterface {
  private _mixins?: MixinInterface[];

  constructor(name: string, modifier?: ECClassModifier) {
    super(name, modifier);

    this.key.type = SchemaChildType.EntityClass;
  }

  set mixins(mixins: MixinInterface[]) {
    this._mixins = mixins;
  }
  get mixins(): MixinInterface[] {
    if (!this._mixins)
      return [];
    return this._mixins;
  }

  /**
   *
   * @param mixin
   */
  public addMixin(mixin: MixinInterface | MixinInterface[]) {
    if (!this._mixins)
      this._mixins = [];

    if (Array.isArray(mixin)) {
      this._mixins.concat(mixin);
      return;
    }

    this._mixins.push(mixin);
    return;
  }

  /**
   * Searches the base class, if one exists, first then any mixins that exist for the property with the name provided.
   * @param name The name of the property to find.
   */
  public getInheritedProperty<T extends PropertyInterface>(name: string): T | undefined {
    let inheritedProperty = super.getInheritedProperty(name);

    if (!inheritedProperty && this._mixins) {
      this._mixins.some((mixin) => {
        inheritedProperty = mixin.getProperty(name);
        return inheritedProperty !== undefined;
      });
    }

    return inheritedProperty as T;
  }

  /**
   *
   * @param name
   * @param relationship
   * @param direction
   */
  public createNavigationProperty(name: string, relationship: string | RelationshipClassInterface, direction: string | RelatedInstanceDirection): NavigationPropertyInterface {
    if (this.getProperty(name))
      throw new ECObjectsError(ECObjectsStatus.DuplicateProperty, `An ECProperty with the name ${name} already exists in the class ${this.name}.`);

    if (typeof(relationship) === "string") {
      // Attempt to locate the relationship
      throw new ECObjectsError(ECObjectsStatus.ECOBJECTS_ERROR_BASE, ``);
    }

    if (typeof(direction) === "string")
      direction = parseStrengthDirection(direction);

    const navProp = new NavigationProperty(name, relationship, direction);

    if (!this.properties)
      this.properties = [];
    this.properties.push(navProp);

    return navProp;
  }

  /**
   *
   * @param jsonObj
   */
  public fromJson(jsonObj: any): void {
    super.fromJson(jsonObj);

    const loadMixin = (mixinFullName: string) => {
      // TODO: Fix
      if (!this.schema)
        throw new ECObjectsError(ECObjectsStatus.ECOBJECTS_ERROR_BASE, `TODO: Fix this message`);

      const tempMixin = this.schema.getChild<MixinInterface>(mixinFullName);
      if (!tempMixin)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `TODO: Fix this message`);

      if (!this._mixins)
        this._mixins = [];
      this._mixins.push(tempMixin);
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
 * A Typescript class representation of a Mixin.
 */
export class MixinClass extends ECClass implements MixinInterface {
  public appliesTo: string | EntityClassInterface;

  constructor(name: string) {
    super(name, ECClassModifier.Abstract);

    this.key.type = SchemaChildType.MixinClass;
  }

  public fromJson(jsonObj: any): void {
    super.fromJson(jsonObj);

    if (jsonObj.appliesTo) {
      // TODO: Fix
      if (!this.schema)
        throw new ECObjectsError(ECObjectsStatus.ECOBJECTS_ERROR_BASE, `TODO: Fix this error`);
      const tmpClass = this.schema.getChild<EntityClassInterface>(jsonObj.appliesTo);
      if (!tmpClass)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

      this.appliesTo = tmpClass;
    }
  }
}

/**
 * A Typescript class representation of an ECStructClass.
 */
export class StructClass extends ECClass implements ECClassInterface { }

/**
 * A Typescript class representation of an ECCustomAttributeClass.
 */
export class CustomAttributeClass extends ECClass implements CustomAttributeClassInterface {
  public containerType: CustomAttributeContainerType;

  constructor(name: string, modifier?: ECClassModifier) {
    super(name, modifier);

    this.key.type = SchemaChildType.CustomAttributeClass;
  }

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
 * A Typescript class representation of a ECRelationshipClass.
 */
export class RelationshipClass extends ECClass implements RelationshipClassInterface {
  public strength: StrengthType;
  public strengthDirection: RelatedInstanceDirection;
  public readonly source: RelationshipConstraintInterface;
  public readonly target: RelationshipConstraintInterface;

  constructor(name: string, strength?: StrengthType, strengthDirection?: RelatedInstanceDirection, modifier?: ECClassModifier) {
    super(name, modifier);

    this.key.type = SchemaChildType.RelationshipClass;

    if (strength) this.strength = strength; else this.strength = StrengthType.Referencing;
    if (strengthDirection) this.strengthDirection = strengthDirection; else this.strengthDirection = RelatedInstanceDirection.Forward;

    this.source = new RelationshipConstraint(this, RelationshipEnd.Source);
    this.target = new RelationshipConstraint(this, RelationshipEnd.Target);
  }

  /**
   *
   * @param name
   * @param relationship
   * @param direction
   */
  public createNavigationProperty(name: string, relationship: string | RelationshipClassInterface, direction: string | RelatedInstanceDirection): NavigationPropertyInterface {
    if (this.getProperty(name))
      throw new ECObjectsError(ECObjectsStatus.DuplicateProperty, `An ECProperty with the name ${name} already exists in the class ${this.name}.`);

    if (typeof(relationship) === "string") {
      // Attempt to locate the relationship
      throw new ECObjectsError(ECObjectsStatus.ECOBJECTS_ERROR_BASE, ``);
    }

    if (typeof(direction) === "string")
      direction = parseStrengthDirection(direction);

    const navProp = new NavigationProperty(name, relationship, direction);

    if (!this.properties)
      this.properties = [];
    this.properties.push(navProp);

    return navProp;
  }

  /**
   *
   * @param jsonObj
   */
  public fromJson(jsonObj: any): void {
    super.fromJson(jsonObj);

    if (jsonObj.strength) this.strength = parseStrength(jsonObj.strength);
    if (jsonObj.strengthDirection) this.strengthDirection = parseStrengthDirection(jsonObj.strengthDirection);
  }
}

/**
 * A Typescript class representation of a ECRelationshipConstraint.
 */
export class RelationshipConstraint implements RelationshipConstraintInterface {
  private _abstractConstraint: EntityClassInterface | RelationshipClassInterface;
  public relationshipClass: RelationshipClassInterface;
  public relationshipEnd: RelationshipEnd;
  public multiplicity?: RelationshipMultiplicity;
  public polymorphic?: boolean;
  public roleLabel?: string;
  public constraintClasses?: EntityClassInterface[] | RelationshipClassInterface[];

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

  /**
   * Returns true if this RelationshipConstraint is the Source relationship end.
   */
  get isSource(): boolean { return this.relationshipEnd === RelationshipEnd.Source; }

  /**
   * Adds the provided class as a constraint class to this constraint.
   * @param constraint The class to add as a constraint class.
   */
  public addClass(constraint: EntityClassInterface | RelationshipClassInterface): void {
    const areEntityConstraints = undefined !== this.constraintClasses as EntityClassInterface[];

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

  /**
   * Populates this object with the provided json object.
   * @param jsonObj The json representation of an ECRelationshipConstraint using the ECSchemaJson format.
   */
  public fromJson(jsonObj: any): void {
    if (jsonObj.roleLabel) this.roleLabel = jsonObj.roleLabel;
    if (jsonObj.polymorphic) this.polymorphic = jsonObj.polymorphic;

    if (jsonObj.multiplicity) {
      const multTmp = RelationshipMultiplicity.fromString(jsonObj.multiplicity);
      if (!multTmp)
        throw new ECObjectsError(ECObjectsStatus.InvalidMultiplicity, ``);
      this.multiplicity = multTmp;
    }

    // Declare variable here
    let relClassSchema: SchemaInterface | undefined;

    if (jsonObj.abstractConstraint) {
      if (typeof(jsonObj.abstractConstraint) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

      relClassSchema = this.relationshipClass.getSchema();
      if (relClassSchema) {
        const tempAbstractConstraint = relClassSchema.getChild<ECClassInterface>(jsonObj.abstractConstraint);
        if (!tempAbstractConstraint)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

        this.abstractConstraint = tempAbstractConstraint as EntityClassInterface === null ?
                                tempAbstractConstraint as RelationshipClassInterface :
                                tempAbstractConstraint as EntityClassInterface;
      }
    }

    if (jsonObj.constraintClasses) {
      if (!Array.isArray(jsonObj.constraintClasses))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

      if (!relClassSchema)
        relClassSchema = this.relationshipClass.getSchema();

      jsonObj.constraintClasses.forEach((constraintClass: string) => {
        if (relClassSchema) {
          const tempConstraintClass = relClassSchema.getChild<ECClassInterface>(constraintClass);
          if (!tempConstraintClass)
            throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

          this.addClass(tempConstraintClass as EntityClassInterface === null ?
                        tempConstraintClass as RelationshipClassInterface :
                        tempConstraintClass as EntityClassInterface);
        }
      });
    }
  }
}
