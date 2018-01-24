/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import ECClass from "Metadata/Class";
import EntityClass from "Metadata/EntityClass";
import { ECClassModifier, RelatedInstanceDirection, RelationshipEnd, RelationshipMultiplicity, SchemaChildType, StrengthType,
        parseStrength, parseStrengthDirection } from "ECObjects";
import { EntityClassInterface, RelationshipClassInterface, RelationshipConstraintInterface, SchemaInterface } from "Interfaces";
import { ECObjectsError, ECObjectsStatus } from "Exception";
import { NavigationProperty } from "Metadata/Property";

/**
 * A Typescript class representation of a ECRelationshipClass.
 */
export default class RelationshipClass extends ECClass implements RelationshipClassInterface {
  public strength: StrengthType;
  public strengthDirection: RelatedInstanceDirection;
  public readonly source: RelationshipConstraintInterface;
  public readonly target: RelationshipConstraintInterface;

  constructor(schema: SchemaInterface, name: string, strength?: StrengthType, strengthDirection?: RelatedInstanceDirection, modifier?: ECClassModifier) {
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
  public createNavigationProperty(name: string, relationship: string | RelationshipClass, direction?: string | RelatedInstanceDirection): NavigationProperty {
    if (this.getProperty(name))
      throw new ECObjectsError(ECObjectsStatus.DuplicateProperty, `An ECProperty with the name ${name} already exists in the class ${this.name}.`);

    let resolvedRelationship: RelationshipClass | undefined;
    if (typeof(relationship) === "string" && this.schema)
      resolvedRelationship = this.schema.getChildSync<RelationshipClass>(relationship, false);
    else
      resolvedRelationship = relationship as RelationshipClass;

    if (!resolvedRelationship)
      throw new ECObjectsError(ECObjectsStatus.InvalidType, `The provided RelationshipClass, ${relationship}, is not a valid StructClass.`);

    if (!direction)
      direction = RelatedInstanceDirection.Forward;
    else if (typeof(direction) === "string")
      direction = parseStrengthDirection(direction);

    const navProp = new NavigationProperty(name, resolvedRelationship, direction);

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
  private _abstractConstraint: EntityClass | RelationshipClass;
  public relationshipClass: RelationshipClass;
  public relationshipEnd: RelationshipEnd;
  public multiplicity?: RelationshipMultiplicity;
  public polymorphic?: boolean;
  public roleLabel?: string;
  public constraintClasses?: EntityClass[] | RelationshipClass[];

  constructor(relClass: RelationshipClass, relEnd: RelationshipEnd) {
    this.relationshipEnd = relEnd;
    this.polymorphic = false;
    this.multiplicity = RelationshipMultiplicity.zeroOne;
    this.relationshipClass = relClass;
  }

  get abstractConstraint(): EntityClass | RelationshipClass {
    if (this._abstractConstraint)
      return this._abstractConstraint;

    if (this.constraintClasses && this.constraintClasses.length === 1)
      return this.constraintClasses[0];

    return this._abstractConstraint;
  }

  set abstractConstraint(abstractConstraint: EntityClass | RelationshipClass) {
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
    const areEntityConstraints = undefined !== this.constraintClasses as EntityClass[];

    if (areEntityConstraints && (undefined === constraint as EntityClass))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

    // TODO: Handle relationship constraints

    if (!this.constraintClasses)
      this.constraintClasses = [];

    if (areEntityConstraints)
      (this.constraintClasses as EntityClass[]).push(constraint as EntityClass);
    else
      (this.constraintClasses as RelationshipClass[]).push(constraint as RelationshipClass);

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

      relClassSchema = this.relationshipClass.schema;
      if (relClassSchema) {
        const tempAbstractConstraint = relClassSchema.getChildSync<ECClass>(jsonObj.abstractConstraint, false);
        if (!tempAbstractConstraint)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

        this.abstractConstraint = tempAbstractConstraint as EntityClass === null ?
                                tempAbstractConstraint as RelationshipClass :
                                tempAbstractConstraint as EntityClass;
      }
    }

    if (jsonObj.constraintClasses) {
      if (!Array.isArray(jsonObj.constraintClasses))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

      if (!relClassSchema)
        relClassSchema = this.relationshipClass.schema;

      jsonObj.constraintClasses.forEach((constraintClass: string) => {
        if (relClassSchema) {
          const tempConstraintClass = relClassSchema.getChildSync<ECClass>(constraintClass, false);
          if (!tempConstraintClass)
            throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

          this.addClass(tempConstraintClass as EntityClass === null ?
                        tempConstraintClass as RelationshipClass :
                        tempConstraintClass as EntityClass);
        }
      });
    }
  }
}
