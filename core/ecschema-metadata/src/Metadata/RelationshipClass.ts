/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Metadata
 */

import { DelayedPromiseWithProps } from "../DelayedPromise";
import { ECSpecVersion, SchemaReadHelper } from "../Deserialization/Helper";
import { RelationshipClassProps, RelationshipConstraintProps } from "../Deserialization/JsonProps";
import { XmlSerializationUtils } from "../Deserialization/XmlSerializationUtils";
import {
  ECClassModifier, parseStrength, parseStrengthDirection, RelationshipEnd, SchemaItemType, StrengthDirection, strengthDirectionToString,
  strengthToString, StrengthType,
} from "../ECObjects";
import { ECSchemaError, ECSchemaStatus } from "../Exception";
import { LazyLoadedRelationshipConstraintClass } from "../Interfaces";
import { SchemaItemKey } from "../SchemaKey";
import { ECClass } from "./Class";
import { CustomAttribute, CustomAttributeContainerProps, CustomAttributeSet, serializeCustomAttributes } from "./CustomAttribute";
import { createNavigationProperty, createNavigationPropertySync, EntityClass } from "./EntityClass";
import { Mixin } from "./Mixin";
import { NavigationProperty } from "./Property";
import { Schema } from "./Schema";
import { SchemaItem } from "./SchemaItem";

type AnyConstraintClass = EntityClass | Mixin | RelationshipClass;

/**
 * A Typescript class representation of a ECRelationshipClass.
 * @public @preview
 */
export class RelationshipClass extends ECClass {
  public override readonly schemaItemType = RelationshipClass.schemaItemType;
  /** @internal */
  public static override get schemaItemType() { return SchemaItemType.RelationshipClass; }
  /** @internal */
  protected _strength: StrengthType;
  /** @internal */
  protected _strengthDirection: StrengthDirection;
  /** @internal */
  protected _source: RelationshipConstraint;
  /** @internal */
  protected _target: RelationshipConstraint;

  /** @internal */
  constructor(schema: Schema, name: string, modifier?: ECClassModifier) {
    super(schema, name, modifier);
    this._strengthDirection = StrengthDirection.Forward;
    this._strength = StrengthType.Referencing;
    this._source = new RelationshipConstraint(this, RelationshipEnd.Source);
    this._target = new RelationshipConstraint(this, RelationshipEnd.Target);
  }

  public get strength() { return this._strength; }
  public get strengthDirection() { return this._strengthDirection; }
  public get source() { return this._source; }
  public get target() { return this._target; }

  /**
   *
   * @param name
   * @param relationship
   * @param direction
   * @internal
   */
  protected async createNavigationProperty(name: string, relationship: string | RelationshipClass, direction: string | StrengthDirection): Promise<NavigationProperty> {
    return this.addProperty(await createNavigationProperty(this, name, relationship, direction));
  }

  /** @internal */
  protected createNavigationPropertySync(name: string, relationship: string | RelationshipClass, direction: string | StrengthDirection): NavigationProperty {
    return this.addProperty(createNavigationPropertySync(this, name, relationship, direction));
  }

  /**
   * @internal Used for schema editing.
   */
  protected setStrength(strength: StrengthType) {
    this._strength = strength;
  }

  /**
   * @internal Used for schema editing.
   */
  protected setStrengthDirection(direction: StrengthDirection) {
    this._strengthDirection = direction;
  }

  /**
   * @internal Used for schema editing.
   */
  protected setSourceConstraint(source: RelationshipConstraint) {
    this._source = source;
  }

  /**
   * @internal Used for schema editing.
   */
  protected setTargetConstraint(target: RelationshipConstraint) {
    this._target = target;
  }
  /**
   * Save this RelationshipClass's properties to an object for serializing to JSON.
   * @param standalone Serialization includes only this object (as opposed to the full schema).
   * @param includeSchemaVersion Include the Schema's version information in the serialized object.
   */
  public override toJSON(standalone: boolean = false, includeSchemaVersion: boolean = false): RelationshipClassProps {
    const schemaJson = super.toJSON(standalone, includeSchemaVersion) as any;
    schemaJson.strength = strengthToString(this.strength);
    schemaJson.strengthDirection = strengthDirectionToString(this.strengthDirection);
    schemaJson.source = this.source.toJSON();
    schemaJson.target = this.target.toJSON();
    return schemaJson;
  }

  /** @internal */
  public override async toXml(schemaXml: Document): Promise<Element> {
    const itemElement = await super.toXml(schemaXml);
    itemElement.setAttribute("strength", strengthToString(this.strength));
    itemElement.setAttribute("strengthDirection", strengthDirectionToString(this.strengthDirection));
    itemElement.appendChild(await this.source.toXml(schemaXml));
    itemElement.appendChild(await this.target.toXml(schemaXml));
    return itemElement;
  }

  public override fromJSONSync(relationshipClassProps: RelationshipClassProps) {
    super.fromJSONSync(relationshipClassProps);

    let strength = parseStrength(relationshipClassProps.strength);
    if (undefined === strength) {
      if (SchemaReadHelper.isECSpecVersionNewer({ readVersion: relationshipClassProps.originalECSpecMajorVersion, writeVersion: relationshipClassProps.originalECSpecMinorVersion } as ECSpecVersion))
        strength = StrengthType.Referencing;
      else
        throw new ECSchemaError(ECSchemaStatus.InvalidStrength, `The RelationshipClass ${this.fullName} has an invalid 'strength' attribute. '${relationshipClassProps.strength}' is not a valid StrengthType.`);
    }

    const strengthDirection = parseStrengthDirection(relationshipClassProps.strengthDirection);
    if (undefined === strengthDirection)
      throw new ECSchemaError(ECSchemaStatus.InvalidStrength, `The RelationshipClass ${this.fullName} has an invalid 'strengthDirection' attribute. '${relationshipClassProps.strengthDirection}' is not a valid StrengthDirection.`);

    this._strength = strength;
    this._strengthDirection = strengthDirection;
  }

  public override async fromJSON(relationshipClassProps: RelationshipClassProps) {
    this.fromJSONSync(relationshipClassProps);
  }

  /**
   * Type guard to check if the SchemaItem is of type RelationshipClass.
   * @param item The SchemaItem to check.
   * @returns True if the item is a RelationshipClass, false otherwise.
   */
  public static isRelationshipClass(item?: SchemaItem): item is RelationshipClass {
    if (item && item.schemaItemType === SchemaItemType.RelationshipClass)
      return true;

    return false;
  }

  /**
   * Type assertion to check if the SchemaItem is of type RelationshipClass.
   * @param item The SchemaItem to check.
   * @returns The item cast to RelationshipClass if it is a RelationshipClass, undefined otherwise.
   * @internal
   */
  public static assertIsRelationshipClass(item?: SchemaItem): asserts item is RelationshipClass {
    if (!this.isRelationshipClass(item))
      throw new ECSchemaError(ECSchemaStatus.InvalidSchemaItemType, `Expected '${SchemaItemType.RelationshipClass}' (RelationshipClass)`);
  }
}

/**
 * A Typescript class representation of a ECRelationshipConstraint.
 * @public @preview
 */
export class RelationshipConstraint implements CustomAttributeContainerProps {
  private _abstractConstraint?: LazyLoadedRelationshipConstraintClass;
  private _relationshipClass: RelationshipClass;
  private _relationshipEnd: RelationshipEnd;
  private _multiplicity?: RelationshipMultiplicity;
  private _polymorphic?: boolean;
  private _roleLabel?: string;
  private _constraintClasses?: LazyLoadedRelationshipConstraintClass[];
  private _customAttributes?: Map<string, CustomAttribute>;

  /** @internal */
  constructor(relClass: RelationshipClass, relEnd: RelationshipEnd, roleLabel?: string, polymorphic?: boolean) {
    this._relationshipEnd = relEnd;
    if (polymorphic)
      this._polymorphic = polymorphic;
    else
      this._polymorphic = false;

    this._multiplicity = RelationshipMultiplicity.zeroOne;
    this._relationshipClass = relClass;
    this._roleLabel = roleLabel;
  }

  public get multiplicity() { return this._multiplicity ?? RelationshipMultiplicity.zeroOne; }

  public get polymorphic() { return this._polymorphic ?? false; }

  public get roleLabel() { return this._roleLabel; }

  public get constraintClasses(): ReadonlyArray<LazyLoadedRelationshipConstraintClass> | undefined { return this._constraintClasses; }

  public get relationshipClass() { return this._relationshipClass; }

  public get relationshipEnd() { return this._relationshipEnd; }

  public get customAttributes(): CustomAttributeSet | undefined { return this._customAttributes; }

  /** Returns the constraint name, ie. 'RelationshipName.Source/Target' */
  public get fullName() { return `${this._relationshipClass.name}:${this.isSource ? "Source" : "Target"}`; }

  /** Returns the schema of the RelationshipClass. */
  public get schema(): Schema { return this._relationshipClass.schema; }

  public get abstractConstraint(): LazyLoadedRelationshipConstraintClass | undefined {
    if (this._abstractConstraint)
      return this._abstractConstraint;

    if (this.constraintClasses && this.constraintClasses.length === 1)
      return this.constraintClasses[0];

    return this._abstractConstraint;
  }

  /**
   * True if this RelationshipConstraint is the Source relationship end.
   */
  public get isSource(): boolean { return this.relationshipEnd === RelationshipEnd.Source; }

  /**
   * Adds the provided class as a constraint class to this constraint.
   * @param constraint The class to add as a constraint class.
   * @internal
  */
  public addClass(constraint: LazyLoadedRelationshipConstraintClass): void {
    // TODO: Ensure we don't start mixing constraint class types
    // TODO: Check that this class is or subclasses abstract constraint?

    if (!this._constraintClasses)
      this._constraintClasses = [];

    // TODO: Handle relationship constraints
    this._constraintClasses.push(constraint);
  }

  /**
   * Removes the provided class as a constraint class from this constraint.
   * @param constraint The class to add as a constraint class.
   *
   * @internal
   */
  protected removeClass(constraint: LazyLoadedRelationshipConstraintClass): void {
    if (undefined === this._constraintClasses)
      return;

    this._constraintClasses.forEach((item, index) => {
      const constraintName = item.fullName;
      if (constraintName === constraint.fullName)
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this._constraintClasses?.splice(index, 1);
    });
  }

  /**
   * Save this RelationshipConstraint's properties to an object for serializing to JSON.
   */
  public toJSON(): RelationshipConstraintProps {
    const schemaJson: { [value: string]: any } = {};
    schemaJson.multiplicity = this.multiplicity.toString();
    schemaJson.roleLabel = this.roleLabel;
    schemaJson.polymorphic = this.polymorphic;
    if (undefined !== this._abstractConstraint)
      schemaJson.abstractConstraint = this._abstractConstraint.fullName;
    if (undefined !== this.constraintClasses && this.constraintClasses.length > 0)
      schemaJson.constraintClasses = this.constraintClasses.map((constraintClass) => constraintClass.fullName);

    const customAttributes = serializeCustomAttributes(this.customAttributes);
    if (undefined !== customAttributes)
      schemaJson.customAttributes = customAttributes;
    return schemaJson as RelationshipConstraintProps;
  }

  /** @internal */
  public async toXml(schemaXml: Document): Promise<Element> {
    const elementName = this.isSource ? "Source" : "Target";
    const itemElement = schemaXml.createElement(elementName);
    if (undefined !== this.polymorphic)
      itemElement.setAttribute("polymorphic", this.polymorphic.toString());
    if (undefined !== this.roleLabel)
      itemElement.setAttribute("roleLabel", this.roleLabel);
    if (undefined !== this.multiplicity)
      itemElement.setAttribute("multiplicity", this.multiplicity.toString());

    const abstractConstraint = await this.abstractConstraint;
    if (undefined !== abstractConstraint) {
      const abstractConstraintName = XmlSerializationUtils.createXmlTypedName(this.schema, abstractConstraint.schema, abstractConstraint.name);
      itemElement.setAttribute("abstractConstraint", abstractConstraintName);
    }

    if (undefined !== this.constraintClasses) {
      for (const item of this.constraintClasses) {
        const constraintClass = await item;
        const classElement = schemaXml.createElement("Class");
        const constraintClassName = XmlSerializationUtils.createXmlTypedName(this.schema, constraintClass.schema, constraintClass.name);
        classElement.setAttribute("class", constraintClassName);
        itemElement.appendChild(classElement);
      }
    }

    if (this._customAttributes) {
      const caContainerElement = schemaXml.createElement("ECCustomAttributes");
      for (const [name, attribute] of this._customAttributes) {
        const caElement = await XmlSerializationUtils.writeCustomAttribute(name, attribute, schemaXml, this.schema);
        caContainerElement.appendChild(caElement);
      }
      itemElement.appendChild(caContainerElement);
    }

    return itemElement;
  }

  public fromJSONSync(relationshipConstraintProps: RelationshipConstraintProps) {

    this._roleLabel = relationshipConstraintProps.roleLabel;
    this._polymorphic = relationshipConstraintProps.polymorphic;

    const parsedMultiplicity = RelationshipMultiplicity.fromString(relationshipConstraintProps.multiplicity);
    if (!parsedMultiplicity)
      throw new ECSchemaError(ECSchemaStatus.InvalidMultiplicity, ``);
    this._multiplicity = parsedMultiplicity;

    const relClassSchema = this.relationshipClass.schema;

    if (undefined !== relationshipConstraintProps.abstractConstraint) {
      const abstractConstraintSchemaItemKey = relClassSchema.getSchemaItemKey(relationshipConstraintProps.abstractConstraint);
      if (!abstractConstraintSchemaItemKey)
        throw new ECSchemaError(ECSchemaStatus.InvalidECJson, `Unable to locate the abstractConstraint ${relationshipConstraintProps.abstractConstraint}.`);
      this.setAbstractConstraint(new DelayedPromiseWithProps<SchemaItemKey, AnyConstraintClass>(abstractConstraintSchemaItemKey,
        async () => {
          const tempAbstractConstraint = await relClassSchema.lookupItem(relationshipConstraintProps.abstractConstraint!);
          if (undefined === tempAbstractConstraint ||
            (!EntityClass.isEntityClass(tempAbstractConstraint) && !Mixin.isMixin(tempAbstractConstraint) && !RelationshipClass.isRelationshipClass(tempAbstractConstraint)))
            throw new ECSchemaError(ECSchemaStatus.InvalidECJson, `Unable to locate the abstractConstraint ${relationshipConstraintProps.abstractConstraint}.`);

          return tempAbstractConstraint;
        }));
    }

    const loadEachConstraint = (constraintClassName: any) => {
      const tempConstraintClass = relClassSchema.lookupItemSync(constraintClassName);
      if (!tempConstraintClass ||
        (!EntityClass.isEntityClass(tempConstraintClass) && !Mixin.isMixin(tempConstraintClass) && !RelationshipClass.isRelationshipClass(tempConstraintClass)))
        throw new ECSchemaError(ECSchemaStatus.InvalidECJson, ``);
      return tempConstraintClass;
    };

    for (const constraintClassName of relationshipConstraintProps.constraintClasses) {
      const constraintClass = loadEachConstraint(constraintClassName);
      this.addClass(new DelayedPromiseWithProps(constraintClass.key, async () => constraintClass));
    }
  }

  public async fromJSON(relationshipConstraintProps: RelationshipConstraintProps) {
    this.fromJSONSync(relationshipConstraintProps);
  }

  /**
   * Indicates if the provided [[ECClass]] is supported by this [[RelationshipConstraint]].
   * @param ecClass The class to check.
   */
  public async supportsClass(ecClass: ECClass): Promise<boolean> {
    if (!this.constraintClasses) {
      if (this.relationshipClass.baseClass) {
        const baseRelationship = await this.relationshipClass.baseClass as RelationshipClass;
        const baseConstraint = this.isSource ? baseRelationship.source : baseRelationship.target;
        return baseConstraint.supportsClass(ecClass);
      }
      return false;
    }

    if (ecClass.schemaItemType !== SchemaItemType.EntityClass && ecClass.schemaItemType !== SchemaItemType.RelationshipClass &&
      ecClass.schemaItemType !== SchemaItemType.Mixin) {
      return false;
    }

    const abstractConstraint = await this.abstractConstraint;

    if (abstractConstraint && await RelationshipConstraint.classCompatibleWithConstraint(abstractConstraint, ecClass, this.polymorphic || false))
      return true;

    for (const constraint of this.constraintClasses) {
      if (await RelationshipConstraint.classCompatibleWithConstraint(await constraint, ecClass, this.polymorphic || false))
        return true;
    }

    return false;
  }

  /**
   * Indicates if an ECClass is of the type or applies to the type (if a mixin) of the ECClass specified by the constraintClass parameter.
   * @param constraintClass The ECClass that is a constraint class of a relationship.
   * @param testClass The ECClass to check against the constraint class.
   * @param isPolymorphic Indicates if the testClass should be checked polymorphically.
   */
  public static async classCompatibleWithConstraint(constraintClass: ECClass, testClass: ECClass, isPolymorphic: boolean): Promise<boolean> {
    if (SchemaItem.equalByKey(constraintClass, testClass))
      return true;

    if (isPolymorphic) {
      if (testClass.schemaItemType === SchemaItemType.EntityClass || testClass.schemaItemType === SchemaItemType.RelationshipClass) {
        return testClass.is(constraintClass);
      }

      if (testClass.schemaItemType === SchemaItemType.Mixin) {
        if (constraintClass.schemaItemType === SchemaItemType.EntityClass)
          return (testClass as Mixin).applicableTo(constraintClass as EntityClass);
        else
          return testClass.is(constraintClass);
      }
    }
    return false;
  }

  /**
   * @internal
   */
  public static isRelationshipConstraint(object: any): object is RelationshipConstraint {
    const relationshipConstraint = object as RelationshipConstraint;

    return relationshipConstraint !== undefined && relationshipConstraint.polymorphic !== undefined && relationshipConstraint.multiplicity !== undefined
      && relationshipConstraint.relationshipEnd !== undefined && relationshipConstraint._relationshipClass !== undefined;
  }

  /** @internal */
  protected addCustomAttribute(customAttribute: CustomAttribute) {
    if (!this._customAttributes)
      this._customAttributes = new Map<string, CustomAttribute>();

    this._customAttributes.set(customAttribute.className, customAttribute);
  }

  /** @internal */
  protected setRoleLabel(roleLabel: string | undefined) {
    this._roleLabel = roleLabel;
  }

  /** @internal */
  protected setRelationshipEnd(relationshipEnd: RelationshipEnd) {
    this._relationshipEnd = relationshipEnd;
  }

  /** @internal */
  protected setPolymorphic(polymorphic: boolean) {
    this._polymorphic = polymorphic;
  }

  /** @internal */
  protected setMultiplicity(multiplicity: RelationshipMultiplicity) {
    this._multiplicity = multiplicity;
  }

  /** @internal */
  protected setAbstractConstraint(abstractConstraint: LazyLoadedRelationshipConstraintClass | undefined) {
    this._abstractConstraint = abstractConstraint;
  }
}

/**
 * Hackish approach that works like a "friend class" so we can access protected members without making them public.
 * @internal
 */
export abstract class MutableRelationshipConstraint extends RelationshipConstraint {
  public abstract override addCustomAttribute(customAttribute: CustomAttribute): void;
  public abstract override setRoleLabel(roleLabel: string | undefined): void;
  public abstract override setRelationshipEnd(relationshipEnd: RelationshipEnd): void;
  public abstract override setPolymorphic(polymorphic: boolean): void;
  public abstract override setMultiplicity(multiplicity: RelationshipMultiplicity): void;
  public abstract override setAbstractConstraint(abstractConstraint: LazyLoadedRelationshipConstraintClass | undefined): void;
}

const INT32_MAX = 2147483647;

/**
 * @public @preview
 */
export class RelationshipMultiplicity {
  public static readonly zeroOne = new RelationshipMultiplicity(0, 1);
  public static readonly zeroMany = new RelationshipMultiplicity(0, INT32_MAX);
  public static readonly oneOne = new RelationshipMultiplicity(1, 1);
  public static readonly oneMany = new RelationshipMultiplicity(1, INT32_MAX);

  public readonly lowerLimit: number;
  public readonly upperLimit: number;

  /** @internal */
  constructor(lowerLimit: number, upperLimit: number) {
    this.lowerLimit = lowerLimit;
    this.upperLimit = upperLimit;
  }

  public static fromString(str: string): RelationshipMultiplicity | undefined {
    const matches = /^\(([0-9]*)\.\.([0-9]*|\*)\)$/.exec(str);
    if (matches === null || matches.length !== 3)
      return undefined;

    const lowerLimit = parseInt(matches[1], 10);
    const upperLimit = matches[2] === "*" ? INT32_MAX : parseInt(matches[2], 10);
    if (0 === lowerLimit && 1 === upperLimit)
      return RelationshipMultiplicity.zeroOne;
    else if (0 === lowerLimit && INT32_MAX === upperLimit)
      return RelationshipMultiplicity.zeroMany;
    else if (1 === lowerLimit && 1 === upperLimit)
      return RelationshipMultiplicity.oneOne;
    else if (1 === lowerLimit && INT32_MAX === upperLimit)
      return RelationshipMultiplicity.oneMany;

    return new RelationshipMultiplicity(lowerLimit, upperLimit);
  }

  public equals(rhs: RelationshipMultiplicity): boolean {
    return this.lowerLimit === rhs.lowerLimit && this.upperLimit === rhs.upperLimit;
  }

  public toString(): string {
    return `(${this.lowerLimit}..${this.upperLimit === INT32_MAX ? "*" : this.upperLimit})`;
  }
}

/**
 * @internal
 * An abstract class used for schema editing.
 */
export abstract class MutableRelationshipClass extends RelationshipClass {
  public override get source() { return this._source as MutableRelationshipConstraint; }
  public override get target() { return this._target as MutableRelationshipConstraint; }
  public abstract override setStrength(strength: StrengthType): void;
  public abstract override setStrengthDirection(direction: StrengthDirection): void;
  public abstract override createNavigationProperty(name: string, relationship: string | RelationshipClass, direction: string | StrengthDirection): Promise<NavigationProperty>;
  public abstract override createNavigationPropertySync(name: string, relationship: string | RelationshipClass, direction: string | StrengthDirection): NavigationProperty;
  public abstract override setDisplayLabel(displayLabel: string): void;
}
