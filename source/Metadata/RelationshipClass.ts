/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import ECClass from "./Class";
import { ECClassModifier, RelatedInstanceDirection, RelationshipEnd, RelationshipMultiplicity, SchemaChildType, StrengthType,
        parseStrength, parseStrengthDirection } from "../ECObjects";
import { LazyLoadedRelationshipConstraintClass } from "../Interfaces";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { NavigationProperty } from "./Property";
import { DelayedPromiseWithProps } from "../DelayedPromise";
import EntityClass from "./EntityClass";
import MixinClass from "./MixinClass";
import Schema from "./Schema";

type AnyConstraintClass = EntityClass | MixinClass | RelationshipClass;

/**
 * A Typescript class representation of a ECRelationshipClass.
 */
export default class RelationshipClass extends ECClass {
  public schema: Schema;
  public readonly type: SchemaChildType.RelationshipClass;
  public strength: StrengthType;
  public strengthDirection: RelatedInstanceDirection;
  public readonly source: RelationshipConstraint;
  public readonly target: RelationshipConstraint;

  constructor(schema: Schema, name: string, strength?: StrengthType, strengthDirection?: RelatedInstanceDirection, modifier?: ECClassModifier) {
    super(schema, name, modifier);

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
  public async createNavigationProperty(name: string, relationship: string | RelationshipClass, direction?: string | RelatedInstanceDirection): Promise<NavigationProperty> {
    if (await this.getProperty(name))
      throw new ECObjectsError(ECObjectsStatus.DuplicateProperty, `An ECProperty with the name ${name} already exists in the class ${this.name}.`);

    let resolvedRelationship: RelationshipClass | undefined;
    if (typeof(relationship) === "string")
      resolvedRelationship = await this.schema.getChild<RelationshipClass>(relationship, false);
    else
      resolvedRelationship = relationship;

    if (!resolvedRelationship)
      throw new ECObjectsError(ECObjectsStatus.InvalidType, `The provided RelationshipClass, ${relationship}, is not a valid RelationshipClassInterface.`);

    if (!direction)
      direction = RelatedInstanceDirection.Forward;
    else if (typeof(direction) === "string")
      direction = parseStrengthDirection(direction);

    const lazyRelationship = new DelayedPromiseWithProps(resolvedRelationship.key, async () => resolvedRelationship!);
    return this.addProperty(new NavigationProperty(this, name, lazyRelationship, direction));
  }

  /**
   *
   * @param jsonObj
   */
  public async fromJson(jsonObj: any): Promise<void> {
    await super.fromJson(jsonObj);

    if (undefined !== jsonObj.strength) {
      if (typeof(jsonObj.strength) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The RelationshipClass ${this.name} has an invalid 'strength' attribute. It should be of type 'string'.`);
      this.strength = parseStrength(jsonObj.strength);
    }

    if (undefined !== jsonObj.strengthDirection) {
      if (typeof(jsonObj.strengthDirection) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The RelationshipClass ${this.name} has an invalid 'strengthDirection' attribute. It should be of type 'string'.`);
      this.strengthDirection = parseStrengthDirection(jsonObj.strengthDirection);
    }
  }
}

/**
 * A Typescript class representation of a ECRelationshipConstraint.
 */
export class RelationshipConstraint {
  protected _abstractConstraint?: LazyLoadedRelationshipConstraintClass;
  public relationshipClass: RelationshipClass;
  public relationshipEnd: RelationshipEnd;
  public multiplicity?: RelationshipMultiplicity;
  public polymorphic?: boolean;
  public roleLabel?: string;
  public constraintClasses?: LazyLoadedRelationshipConstraintClass[];

  constructor(relClass: RelationshipClass, relEnd: RelationshipEnd) {
    this.relationshipEnd = relEnd;
    this.polymorphic = false;
    this.multiplicity = RelationshipMultiplicity.zeroOne;
    this.relationshipClass = relClass;
  }

  get abstractConstraint(): LazyLoadedRelationshipConstraintClass | undefined {
    if (this._abstractConstraint)
      return this._abstractConstraint;

    if (this.constraintClasses && this.constraintClasses.length === 1)
      return this.constraintClasses[0];

    return this._abstractConstraint;
  }

  set abstractConstraint(abstractConstraint: LazyLoadedRelationshipConstraintClass | undefined) {
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
  public addClass(constraint: EntityClass | MixinClass | RelationshipClass): void {
    // Ensure we don't start mixing constraint class types
    if (this.constraintClasses && this.constraintClasses.length > 0 && this.constraintClasses[0].type !== constraint.key.type)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

    if (!this.constraintClasses)
      this.constraintClasses = [];

    // TODO: Handle relationship constraints
    this.constraintClasses.push(new DelayedPromiseWithProps(constraint.key, async () => constraint));
  }

  /**
   * Populates this object with the provided json object.
   * @param jsonObj The json representation of an ECRelationshipConstraint using the ECSchemaJson format.
   */
  public async fromJson(jsonObj: any): Promise<void> {
    if (undefined !== jsonObj.roleLabel) {
      if (typeof(jsonObj.roleLabel) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The RelationshipConstraint ${debugName(this)} has an invalid 'roleLabel' attribute. It should be of type 'string'.`);
      this.roleLabel = jsonObj.roleLabel;
    }

    if (undefined !== jsonObj.polymorphic) {
      if (typeof(jsonObj.polymorphic) !== "boolean")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The RelationshipConstraint ${debugName(this)} has an invalid 'polymorphic' attribute. It should be of type 'boolean'.`);
      this.polymorphic = jsonObj.polymorphic;
    }

    if (undefined !== jsonObj.multiplicity) {
      if (typeof(jsonObj.multiplicity) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The RelationshipConstraint ${debugName(this)} has an invalid 'multiplicity' attribute. It should be of type 'string'.`);

      const parsedMultiplicity = RelationshipMultiplicity.fromString(jsonObj.multiplicity);
      if (!parsedMultiplicity)
        throw new ECObjectsError(ECObjectsStatus.InvalidMultiplicity, ``);
      this.multiplicity = parsedMultiplicity;
    }

    const relClassSchema = this.relationshipClass.schema;

    if (undefined !== jsonObj.abstractConstraint) {
      if (typeof(jsonObj.abstractConstraint) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The RelationshipConstraint ${debugName(this)} has an invalid 'abstractConstraint' attribute. It should be of type 'string'.`);

      const tempAbstractConstraint = await relClassSchema.getChild<AnyConstraintClass>(jsonObj.abstractConstraint, false);
      if (!tempAbstractConstraint)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

      this.abstractConstraint = new DelayedPromiseWithProps(tempAbstractConstraint.key, async () => tempAbstractConstraint);
    }

    if (undefined !== jsonObj.constraintClasses) {
      if (!Array.isArray(jsonObj.constraintClasses))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The RelationshipConstraint ${debugName(this)} has an invalid 'constraintClasses' attribute. It should be of type 'string[]'.`);

      const loadEachConstraint = async (constraintClassName: any) => {
        if (typeof(constraintClassName) !== "string")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The RelationshipConstraint ${debugName(this)} has an invalid 'constraintClasses' attribute. It should be of type 'string[]'.`);

        const tempConstraintClass = await relClassSchema.getChild<AnyConstraintClass>(constraintClassName, false);
        if (!tempConstraintClass)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

        return tempConstraintClass;
      };
      const constraintClasses = await Promise.all<AnyConstraintClass>(jsonObj.constraintClasses.map(loadEachConstraint));
      constraintClasses.forEach((constraintClass: AnyConstraintClass) => this.addClass(constraintClass));
    }
  }
}

function debugName(constraint: RelationshipConstraint): string {
  return constraint.relationshipClass.name + ((constraint.isSource) ? ".source" : ".target");
}
