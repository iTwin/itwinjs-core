/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { AbstractParser } from "./AbstractParser";
import {
  ClassProps, ConstantProps, CustomAttributeClassProps, EntityClassProps, EnumerationPropertyProps, EnumerationProps, EnumeratorProps, FormatProps, InvertedUnitProps, KindOfQuantityProps,
  MixinProps, NavigationPropertyProps, PhenomenonProps, PrimitiveArrayPropertyProps, PrimitiveOrEnumPropertyBaseProps, PrimitivePropertyProps, PropertyCategoryProps,
  PropertyProps, RelationshipClassProps, RelationshipConstraintProps, SchemaItemProps, SchemaProps, SchemaReferenceProps, StructArrayPropertyProps, StructPropertyProps, UnitProps,
} from "./JsonProps";
import { parseStrength, parseStrengthDirection, SchemaItemType } from "../ECObjects";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { AnyClass } from "../Interfaces";
import { ECName } from "../SchemaKey";
import { CustomAttribute } from "../Metadata/CustomAttribute";

function isObject(x: unknown): x is { [name: string]: unknown } {
  return typeof (x) === "object";
}

/** @hidden */
export class JsonParser extends AbstractParser<object> {

  /**
   * Type checks Schema and returns SchemaProps interface
   * @param jsonObj
   * @returns SchemaProps
   */
  public parseSchemaProps(jsonObj: unknown): SchemaProps {
    if (!isObject(jsonObj))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Invalid JSON object.`);
    if (undefined === jsonObj.$schema)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECSchema is missing the required '$schema' attribute.`);
    if (typeof (jsonObj.$schema) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECSchema has an invalid '$schema' attribute. It should be of type 'string'.`);

    if (undefined === jsonObj.name)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECSchema is missing the required 'name' attribute.`);
    if (typeof (jsonObj.name) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECSchema has an invalid 'name' attribute. It should be of type 'string'.`);

    if (undefined === jsonObj.version)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECSchema ${jsonObj.name} is missing the required 'version' attribute.`);
    if (typeof (jsonObj.version) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECSchema ${jsonObj.name} has an invalid 'version' attribute. It should be of type 'string'.`);

    if (undefined !== jsonObj.alias) {
      if (typeof (jsonObj.alias) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECSchema ${jsonObj.name} has an invalid 'alias' attribute. It should be of type 'string'.`);
    }

    if (undefined !== jsonObj.label) {
      if (typeof (jsonObj.label) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECSchema ${jsonObj.name} has an invalid 'label' attribute. It should be of type 'string'.`);
    }

    if (undefined !== jsonObj.description) {
      if (typeof (jsonObj.description) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECSchema ${jsonObj.name} has an invalid 'description' attribute. It should be of type 'string'.`);
    }

    if (undefined !== jsonObj.references) {
      if (!Array.isArray(jsonObj.references))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The schema ${jsonObj.name} has an invalid 'references' property. It should be of type 'object[]'.`);
      const references = new Array<SchemaReferenceProps>();
      for (const ref of jsonObj.references) {
        references.push(this.checkSchemaReference(ref, jsonObj.name));
      }
      jsonObj.references = references;
    }

    if (undefined !== jsonObj.items) {
      if (!isObject(jsonObj.items) || Array.isArray(jsonObj.items)) // fails if items is an array or otherwise not an object
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The schema ${jsonObj.name} has an invalid 'items' attribute. It should be of type 'object'.`);

      for (const itemName in jsonObj.items) { // tslint:disable-line:forin
        const parsedItem = this.parseSchemaItemProps(jsonObj.items[itemName], jsonObj.name, itemName); // parse each item to ensure item props are valid
        jsonObj.items[itemName] = parsedItem;
      }
    }

    if (undefined !== jsonObj.customAttributes) {
      if (!Array.isArray(jsonObj.customAttributes))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Schema ${jsonObj.name} has an invalid 'customAttributes' attribute. It should be of type 'array'.`);
      const customAttributeSet = new Array<CustomAttribute>();
      jsonObj.customAttributes.forEach((instance) => {
        if (!instance.className)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `A SchemaItem ${jsonObj.name}.customAttributes instance is missing the required 'className' attribute.`);
        if (typeof (instance.className) !== "string")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `A SchemaItem ${jsonObj.name}.customAttributes instance has an invalid 'className' property. It should be of type 'string'.`);
        customAttributeSet.push(instance);
      });
      jsonObj.customAttributes = customAttributeSet;
    }

    return jsonObj as SchemaProps;
  }

  private checkSchemaReference(jsonObj: unknown, schemaName: string): SchemaReferenceProps {
    if (!isObject(jsonObj))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The schema ${schemaName} has an invalid 'references' property. It should be of type 'object[]'.`);
    if (undefined === jsonObj.name)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The schema ${schemaName} has an invalid 'references' property. One of the references is missing the required 'name' property.`);
    if (typeof (jsonObj.name) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The schema ${schemaName} has an invalid 'references' property. One of the references has an invalid 'name' property. It should be of type 'string'.`);
    if (undefined === jsonObj.version)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The schema ${schemaName} has an invalid 'references' property. One of the references is missing the required 'version' property.`);
    if (typeof (jsonObj.version) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The schema ${schemaName} has an invalid 'references' property. One of the references has an invalid 'version' property. It should be of type 'string'.`);
    return jsonObj as SchemaReferenceProps;
  }

  /**
   * Type checks Schema Item and returns SchemaItemProps interface
   * @param jsonObj
   * @param name name of schema item
   * @returns SchemaItemProps
   */
  public parseSchemaItemProps(jsonObj: unknown, schemaName: string, name: string): SchemaItemProps {
    if (!isObject(jsonObj))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `A SchemaItem in ${schemaName} is an invalid JSON object.`);

    if (!ECName.validate(name))
      throw new ECObjectsError(ECObjectsStatus.InvalidECName, `A SchemaItem in ${schemaName} has an invalid 'name' attribute. '${name}' is not a valid ECName.`);

    if (undefined === jsonObj.schemaItemType)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaItem ${schemaName}.${name} is missing the required 'schemaItemType' attribute.`);
    if (typeof (jsonObj.schemaItemType) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaItem ${schemaName}.${name} has an invalid 'schemaItemType' attribute. It should be of type 'string'.`);

    if (undefined !== jsonObj.description) {
      if (typeof (jsonObj.description) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaItem ${schemaName}.${name} has an invalid 'description' attribute. It should be of type 'string'.`);
    }

    if (undefined !== jsonObj.label) {
      if (typeof (jsonObj.label) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaItem ${schemaName}.${name} has an invalid 'label' attribute. It should be of type 'string'.`);
    }

    if (undefined !== jsonObj.schema) {
      if (typeof (jsonObj.schema) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaItem ${schemaName}.${name} has an invalid 'schema' attribute. It should be of type 'string'.`);
    } else
      jsonObj.schema = schemaName;

    if (undefined !== jsonObj.schemaVersion) {
      if (typeof (jsonObj.schemaVersion) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaItem ${schemaName}.${name} has an invalid 'schemaVersion' attribute. It should be of type 'string'.`);
    }
    return jsonObj as SchemaItemProps;
  }

  /**
   * Type checks Class and returns ClassProps interface
   * @param jsonObj
   * @param name name of class
   * @returns ClassProps
   */
  public parseClassProps(jsonObj: unknown, name: string): ClassProps {
    if (!isObject(jsonObj))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECClass ${name} is an invalid JSON object.`);
    if (undefined !== jsonObj.modifier) {
      if (typeof (jsonObj.modifier) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECClass ${name} has an invalid 'modifier' attribute. It should be of type 'string'.`);
    }

    if (undefined !== jsonObj.baseClass) {
      if (typeof (jsonObj.baseClass) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECClass ${name} has an invalid 'baseClass' attribute. It should be of type 'string'.`);
    }
    if (undefined !== jsonObj.customAttributes) {
      if (!Array.isArray(jsonObj.customAttributes)) {
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECClass ${name} has an invalid 'customAttributes' attribute. It should be of type 'array'.`);
      }
    }
    if (undefined !== jsonObj.properties) {
      if (!Array.isArray(jsonObj.properties))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECClass ${name} has an invalid 'properties' attribute. It should be of type 'object[]'.`);
    }
    return jsonObj as ClassProps;
  }

  /**
   * Type checks entity class and returns EntityClassProps interface
   * @param jsonObj
   * @param name name of EntityClass
   * @returns EntityClassProps
   */
  public parseEntityClassProps(jsonObj: unknown, name: string): EntityClassProps {
    if (!isObject(jsonObj))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECEntityClass ${name} is an invalid JSON object.`);
    if (undefined !== jsonObj.mixins) {
      if (!Array.isArray(jsonObj.mixins))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECEntityClass ${jsonObj.schema}.${name} has an invalid 'mixins' attribute. It should be of type 'string[]'.`);
      for (const mixinName of jsonObj.mixins) {
        if (typeof (mixinName) !== "string")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECEntityClass ${jsonObj.schema}.${name} has an invalid 'mixins' attribute. It should be of type 'string[]'.`);
      }
    }
    return jsonObj as EntityClassProps;
  }

  /**
   * Type checks mixin and returns MixinProps interface
   * @param jsonObj
   * @param name name of Mixin
   * @returns MixinProps
   */
  public parseMixinProps(jsonObj: unknown, name: string): MixinProps {
    if (!isObject(jsonObj))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Mixin ${name} is an invalid JSON object.`);
    if (undefined === jsonObj.appliesTo)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Mixin ${name} is missing the required 'appliesTo' attribute.`);
    if (typeof (jsonObj.appliesTo) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Mixin ${name} has an invalid 'appliesTo' property. It should be of type 'string'.`);
    return jsonObj as MixinProps;
  }

  /**
   * Type checks custom attribute class and returns CustomAttributeClassProps interface
   * @param jsonObj
   * @param name name of Custom Attribute Class
   * @returns CustomAttributeClassProps
   */
  public parseCustomAttributeClassProps(jsonObj: unknown, name: string): CustomAttributeClassProps {
    if (!isObject(jsonObj))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The CustomAttributeClass ${name} is an invalid JSON object.`);
    if (undefined === jsonObj.appliesTo)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The CustomAttributeClass ${name} is missing the required 'appliesTo' attribute.`);
    if (typeof (jsonObj.appliesTo) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The CustomAttributeClass ${name} has an invalid 'appliesTo' attribute. It should be of type 'string'.`);
    return jsonObj as CustomAttributeClassProps;
  }

  /**
   * Type checks Relationship Class and returns RelationshipClassProps interface
   * @param jsonObj
   * @param name name of Relationship Class
   * @returns RelationshipClassProps
   */
  public parseRelationshipClassProps(jsonObj: unknown, name: string): RelationshipClassProps {
    if (!isObject(jsonObj))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The RelationshipClass ${name} is an invalid JSON object.`);

    if (undefined === jsonObj.strength)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The RelationshipClass ${name} is missing the required 'strength' attribute.`);
    if (typeof (jsonObj.strength) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The RelationshipClass ${name} has an invalid 'strength' attribute. It should be of type 'string'.`);
    const strength = parseStrength(jsonObj.strength);
    if (undefined === strength)
      throw new ECObjectsError(ECObjectsStatus.InvalidStrength, `The RelationshipClass ${name} has an invalid 'strength' attribute. '${jsonObj.strength}' is not a valid StrengthType.`);
    jsonObj.strength = strength;

    if (undefined === jsonObj.strengthDirection)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The RelationshipClass ${name} is missing the required 'strengthDirection' attribute.`);
    if (typeof (jsonObj.strengthDirection) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The RelationshipClass ${name} has an invalid 'strengthDirection' attribute. It should be of type 'string'.`);
    const strengthDirection = parseStrengthDirection(jsonObj.strengthDirection);
    if (undefined === strengthDirection)
      throw new ECObjectsError(ECObjectsStatus.InvalidStrength, `The RelationshipClass ${name} has an invalid 'strengthDirection' attribute. '${jsonObj.strengthDirection}' is not a valid StrengthDirection.`);
    jsonObj.strengthDirection = strengthDirection;

    if (undefined === jsonObj.source)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The RelationshipClass ${name} is missing the required source constraint.`);
    if (typeof (jsonObj.source) !== "object")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The RelationshipClass ${name} has an invalid source constraint. It should be of type 'object'.`);

    if (undefined === jsonObj.target)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The RelationshipClass ${name} is missing the required target constraint.`);
    if (typeof (jsonObj.target) !== "object")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The RelationshipClass ${name} has an invalid target constraint. It should be of type 'object'.`);

    return jsonObj as RelationshipClassProps;
  }

  /**
   * Type checks Relationship Constraint and returns RelationshipConstraintProps interface
   * @param relClassName Relationship class name
   * @param isSource For sake of error message, is this relationship constraint a source or target
   * @param jsonObj
   * @returns RelationshipConstraintProps
   */
  public parseRelationshipConstraintProps(relClassName: string, jsonObj: unknown, isSource?: boolean): RelationshipConstraintProps {
    const constraintName = `${(isSource) ? "Source" : "Target"} Constraint of ${relClassName}`; // most specific name to call RelationshipConstraint
    const className = `RelationshipConstraint ${relClassName}`; // less specific name if isSource is undefined

    if (!isObject(jsonObj))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ${(isSource !== undefined) ? `${constraintName}` : `${className}`} is an invalid JSON object.`);

    if (undefined === jsonObj.multiplicity)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ${(isSource !== undefined) ? `${constraintName}` : `${className}`} is missing the required 'multiplicity' attribute.`);
    if (typeof (jsonObj.multiplicity) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ${(isSource !== undefined) ? `${constraintName}` : `${className}`} has an invalid 'multiplicity' attribute. It should be of type 'string'.`);

    if (undefined === jsonObj.roleLabel)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ${(isSource !== undefined) ? `${constraintName}` : `${className}`} is missing the required 'roleLabel' attribute.`);
    if (typeof (jsonObj.roleLabel) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ${(isSource !== undefined) ? `${constraintName}` : `${className}`} has an invalid 'roleLabel' attribute. It should be of type 'string'.`);

    if (undefined === jsonObj.polymorphic)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ${(isSource !== undefined) ? `${constraintName}` : `${className}`} is missing the required 'polymorphic' attribute.`);
    if (typeof (jsonObj.polymorphic) !== "boolean")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ${(isSource !== undefined) ? `${constraintName}` : `${className}`} has an invalid 'polymorhpic' attribute. It should be of type 'boolean'.`);

    if (undefined !== jsonObj.abstractConstraint && typeof (jsonObj.abstractConstraint) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ${(isSource !== undefined) ? `${constraintName}` : `${className}`} has an invalid 'abstractConstraint' attribute. It should be of type 'string'.`);

    if (undefined === jsonObj.constraintClasses)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ${(isSource !== undefined) ? `${constraintName}` : `${className}`} is missing the required 'constraintClasses' attribute.`);
    if (!Array.isArray(jsonObj.constraintClasses))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ${(isSource !== undefined) ? `${constraintName}` : `${className}`} has an invalid 'constraintClasses' attribute. It should be of type 'string[]'.`);

    for (const constraintClassName of jsonObj.constraintClasses) {
      if (typeof (constraintClassName) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ${(isSource !== undefined) ? `${constraintName}` : `${className}`} has an invalid 'constraintClasses' attribute. It should be of type 'string[]'.`);
    }

    if (undefined !== jsonObj.customAttributes && !Array.isArray(jsonObj.customAttributes))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ${(isSource !== undefined) ? `${constraintName}` : `${className}`} has an invalid 'customAttributes' attribute. It should be of type 'array'.`);

    return jsonObj as RelationshipConstraintProps;
  }

  /**
   * Type checks Enumeration and returns EnumerationProps interface
   * @param jsonObj
   * @param name name of enumeration
   * @returns EnumerationProps
   */
  public parseEnumerationProps(jsonObj: unknown, name: string): EnumerationProps {
    if (!isObject(jsonObj))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${name} is an invalid JSON object.`);

    if (undefined === jsonObj.type)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${name} is missing the required 'type' attribute.`);
    if (typeof (jsonObj.type) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${name} has an invalid 'type' attribute. It should be of type 'string'.`);

    const isValidEnumerationType = (type: string): boolean => {
      type = type.toLowerCase();
      return (type === "int") ||
        (type === "integer") ||
        (type === "string");
    };
    if (!isValidEnumerationType(jsonObj.type))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${name} has an invalid 'type' attribute. It should be either "int" or "string".`);

    if (undefined !== jsonObj.isStrict) { // TODO: make required
      if (typeof (jsonObj.isStrict) !== "boolean")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${name} has an invalid 'isStrict' attribute. It should be of type 'boolean'.`);
    }

    if (undefined === jsonObj.enumerators)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${name} is missing the required 'enumerators' attribute.`);
    if (!Array.isArray(jsonObj.enumerators))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${name} has an invalid 'enumerators' attribute. It should be of type 'object[]'.`);

    const enumeratorProps = Array<EnumeratorProps>();
    jsonObj.enumerators.forEach((enumerator: unknown) => {
      if (!isObject(enumerator))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${name} has an invalid 'enumerators' attribute. It should be of type 'object[]'.`);

      if (undefined === enumerator.value)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${name} has an enumerator that is missing the required attribute 'value'.`);

      const expectedType = jsonObj.type as string;
      const receivedType = (typeof (enumerator.value) === "number") ? "int" : typeof (enumerator.value);
      if (!expectedType.includes(receivedType)) // is receivedType a substring of expectedType? - easiest way to check "int" === "int" | "integer" && "string" === "string"
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${name} has an incompatible type. It must be "${expectedType}", not "${receivedType}".`);

      if (undefined === enumerator.name)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${name} has an enumerator that is missing the required attribute 'name'.`);
      if (typeof (enumerator.name) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${name} has an enumerator with an invalid 'name' attribute. It should be of type 'string'.`);

      if (undefined !== enumerator.label) {
        if (typeof (enumerator.label) !== "string")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${name} has an enumerator with an invalid 'label' attribute. It should be of type 'string'.`);
      }

      if (undefined !== enumerator.description) {
        if (typeof (enumerator.description) !== "string")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${name} has an enumerator with an invalid 'description' attribute. It should be of type 'string'.`);
      }
      enumeratorProps.push(enumerator as EnumeratorProps);
    });
    jsonObj.enumerators = enumeratorProps;

    return jsonObj as EnumerationProps;
  }

  /**
   * Type checks KindOfQuantity and returns KindOfQuantityProps interface
   * @param jsonObj
   * @param name name of koq
   * @returns KindOfQuantityProps
   */
  public parseKindOfQuantityProps(jsonObj: unknown, name: string): KindOfQuantityProps { // TODO: func needs to throw errors for non-existent Formats
    if (!isObject(jsonObj))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The KindOfQuantity ${name} is an invalid JSON object.`);

    if (undefined === jsonObj.relativeError)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The KindOfQuantity ${name} is missing the required 'relativeError' attribute.`);
    if (typeof (jsonObj.relativeError) !== "number")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The KindOfQuantity ${name} has an invalid 'relativeError' attribute. It should be of type 'number'.`);

    if (undefined !== jsonObj.presentationUnits) {
      if (!Array.isArray(jsonObj.presentationUnits)) {
        if (typeof (jsonObj.presentationUnits) === "string") // must be a string or an array
          jsonObj.presentationUnits = jsonObj.presentationUnits.split(";") as string[];
        else
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The KindOfQuantity ${name} has an invalid 'presentationUnits' attribute. It should be of type 'string' or 'string[]'.`);
      }
    }

    if (undefined === jsonObj.persistenceUnit)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The KindOfQuantity ${name} is missing the required 'persistenceUnit' attribute.`);
    if (typeof (jsonObj.persistenceUnit) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The KindOfQuantity ${name} has an invalid 'persistenceUnit' attribute. It should be of type 'string'.`);

    return jsonObj as KindOfQuantityProps;
  }

  /**
   * Type checks Property Category and returns PropertyCategoryProps interface
   * @param jsonObj
   * @param name name of property category
   * @returns PropertyCategoryProps
   */
  public parsePropertyCategoryProps(jsonObj: unknown, name: string): PropertyCategoryProps {
    if (!isObject(jsonObj))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The PropertyCategory ${name} is an invalid JSON object.`);
    if (undefined !== jsonObj.priority) { // TODO: make required
      if (typeof (jsonObj.priority) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The PropertyCategory ${name} has an invalid 'priority' attribute. It should be of type 'number'.`);
    }

    return jsonObj as PropertyCategoryProps;
  }

  /**
   * Type checks unit and returns UnitProps interface
   * @param jsonObj
   * @param name name of unit
   * @returns UnitProps
   */
  public parseUnitProps(jsonObj: unknown, name: string): UnitProps {
    if (!isObject(jsonObj))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${name} is an invalid JSON object.`);
    if (undefined === jsonObj.phenomenon)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${name} does not have the required 'phenomenon' attribute.`);
    if (typeof (jsonObj.phenomenon) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${name} has an invalid 'phenomenon' attribute. It should be of type 'string'.`);

    if (undefined === jsonObj.unitSystem)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${name} does not have the required 'unitSystem' attribute.`);
    if (typeof (jsonObj.unitSystem) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${name} has an invalid 'unitSystem' attribute. It should be of type 'string'.`);

    if (undefined === jsonObj.definition)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${name} does not have the required 'definition' attribute.`);
    if (typeof (jsonObj.definition) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${name} has an invalid 'definition' attribute. It should be of type 'string'.`);

    if (undefined !== jsonObj.numerator) {
      if (typeof (jsonObj.numerator) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${name} has an invalid 'numerator' attribute. It should be of type 'number'.`);
    }

    if (undefined !== jsonObj.denominator) {
      if (typeof (jsonObj.denominator) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${name} has an invalid 'denominator' attribute. It should be of type 'number'.`);
    }

    if (undefined !== jsonObj.offset) {
      if (typeof (jsonObj.offset) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${name} has an invalid 'offset' attribute. It should be of type 'number'.`);
    }
    return jsonObj as UnitProps;
  }

  /**
   * Type checks inverted unit and returns InvertedUnitProps interface
   * @param jsonObj
   * @param name name of inverted unit
   * @returns InvertedUnitProps
   */
  public parseInvertedUnitProps(jsonObj: unknown, name: string): InvertedUnitProps {
    if (!isObject(jsonObj))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The InvertedUnit ${name} is an invalid JSON object.`);
    if (undefined === jsonObj.invertsUnit)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The InvertedUnit ${name} does not have the required 'invertsUnit' attribute.`);
    if (typeof (jsonObj.invertsUnit) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The InvertedUnit ${name} has an invalid 'invertsUnit' attribute. It should be of type 'string'.`);

    if (undefined === jsonObj.unitSystem)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The InvertedUnit ${name} does not have the required 'unitSystem' attribute.`);
    if (typeof (jsonObj.unitSystem) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The InvertedUnit ${name} has an invalid 'unitSystem' attribute. It should be of type 'string'.`);

    return jsonObj as InvertedUnitProps;
  }

  /**
   * Type checks constant and returns ConstantProps interface
   * @param jsonObj
   * @param name name of constant
   * @returns ConstantProps
   */
  public parseConstantProps(jsonObj: unknown, name: string): ConstantProps {
    if (!isObject(jsonObj))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Constant ${name} is an invalid JSON object.`);
    if (undefined === jsonObj.phenomenon)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Constant ${name} does not have the required 'phenomenon' attribute.`);
    if (typeof (jsonObj.phenomenon) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Constant ${name} has an invalid 'phenomenon' attribute. It should be of type 'string'.`);

    if (undefined === jsonObj.definition)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Constant ${name} does not have the required 'definition' attribute.`);
    if (typeof (jsonObj.definition) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Constant ${name} has an invalid 'definition' attribute. It should be of type 'string'.`);

    if (undefined !== jsonObj.numerator) {
      if (typeof (jsonObj.numerator) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Constant ${name} has an invalid 'numerator' attribute. It should be of type 'number'.`);
    }

    if (undefined !== jsonObj.denominator) {
      if (typeof (jsonObj.denominator) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Constant ${name} has an invalid 'denominator' attribute. It should be of type 'number'.`);
    }

    return jsonObj as ConstantProps;
  }

  /**
   * Type checks phenomenon and returns PhenomenonProps interface
   * @param jsonObj
   * @param name name of phenomenon
   * @returns PhenomenonProps
   */
  public parsePhenomenonProps(jsonObj: unknown, name: string): PhenomenonProps {
    if (!isObject(jsonObj))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Phenomenon ${name} is an invalid JSON object.`);
    if (!ECName.validate(name))
      throw new ECObjectsError(ECObjectsStatus.InvalidECName, `The Phenomenon ${jsonObj.schema}.${name} has an invalid 'name' attribute. '${name}' is not a valid ECName.`);
    if (undefined === jsonObj.definition)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Phenomenon ${name} does not have the required 'definition' attribute.`);
    else if (typeof (jsonObj.definition) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Phenomenon ${name} has an invalid 'definition' attribute. It should be of type 'string'.`);
    return jsonObj as PhenomenonProps;
  }

  /**
   * Type checks format and returns FormatProps interface
   * @param jsonObj
   * @param name name of format
   * @returns FormatProps
   */
  public parseFormatProps(jsonObj: unknown, name: string): FormatProps {
    if (!isObject(jsonObj))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${name} is an invalid JSON object.`);
    if (!ECName.validate(name))
      throw new ECObjectsError(ECObjectsStatus.InvalidECName, `The Format ${jsonObj.schema}.${name} has an invalid 'name' attribute. '${name}' is not a valid ECName.`);

    if (undefined === jsonObj.type)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${name} does not have the required 'type' attribute.`);
    if (typeof (jsonObj.type) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${name} has an invalid 'type' attribute. It should be of type 'string'.`);

    if (undefined === jsonObj.precision) // precision is required
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${name} does not have the required 'precision' attribute.`);
    else if (typeof (jsonObj.precision) !== "number") // must be a number
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${name} has an invalid 'precision' attribute. It should be of type 'number'.`);
    else if (!Number.isInteger(jsonObj.precision)) // must be an integer
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${name} has an invalid 'precision' attribute. It should be an integer.`);

    if (undefined !== jsonObj.roundFactor) {
      if (typeof (jsonObj.roundFactor) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${name} has an invalid 'roundFactor' attribute. It should be of type 'number'.`);
    }

    if (undefined !== jsonObj.minWidth) { // optional
      if (typeof (jsonObj.minWidth) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${name} has an invalid 'minWidth' attribute. It should be of type 'number'.`);
      if (!Number.isInteger(jsonObj.minWidth) || jsonObj.minWidth < 0) // must be a positive int
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${name} has an invalid 'minWidth' attribute. It should be a positive integer.`);
    }

    if (undefined !== jsonObj.showSignOption) { // optional; default is "onlyNegative"
      if (typeof (jsonObj.showSignOption) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${name} has an invalid 'showSignOption' attribute. It should be of type 'string'.`);
    }

    if (undefined !== jsonObj.formatTraits) {
      if (!Array.isArray(jsonObj.formatTraits) && typeof (jsonObj.formatTraits) !== "string") // must be either an array of strings or a string
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${name} has an invalid 'formatTraits' attribute. It should be of type 'string' or 'string[]'.`);
    }

    if (undefined !== jsonObj.decimalSeparator) { // optional
      if (typeof (jsonObj.decimalSeparator) !== "string") // not a string or not a one character string
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${name} has an invalid 'decimalSeparator' attribute. It should be of type 'string'.`);
      if (jsonObj.decimalSeparator.length !== 1)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${name} has an invalid 'decimalSeparator' attribute. It must be a one character string.`);
    }

    if (undefined !== jsonObj.thousandSeparator) { // optional
      if (typeof (jsonObj.thousandSeparator) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${name} has an invalid 'thousandSeparator' attribute. It should be of type 'string'.`);
      if (jsonObj.thousandSeparator.length !== 1)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${name} has an invalid 'thousandSeparator' attribute. It must be a one character string.`);
    }

    if (undefined !== jsonObj.uomSeparator) { // optional; default is " "
      if (typeof (jsonObj.uomSeparator) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${name} has an invalid 'uomSeparator' attribute. It should be of type 'string'.`);
      if (jsonObj.uomSeparator.length !== 1)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${name} has an invalid 'uomSeparator' attribute. It must be a one character string.`);
    }

    if (undefined !== jsonObj.scientificType) {
      if (typeof (jsonObj.scientificType) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${name} has an invalid 'scientificType' attribute. It should be of type 'string'.`);
    }

    if (undefined !== jsonObj.stationOffsetSize) {
      if (typeof (jsonObj.stationOffsetSize) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${name} has an invalid 'stationOffsetSize' attribute. It should be of type 'number'.`);
      if (!Number.isInteger(jsonObj.stationOffsetSize) || jsonObj.stationOffsetSize < 0) // must be a positive int > 0
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${name} has an invalid 'stationOffsetSize' attribute. It should be a positive integer.`);
    }

    if (undefined !== jsonObj.stationSeparator) { // optional; default is "+"
      if (typeof (jsonObj.stationSeparator) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${name} has an invalid 'stationSeparator' attribute. It should be of type 'string'.`);
      if (jsonObj.stationSeparator.length !== 1)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${name} has an invalid 'stationSeparator' attribute. It must be a one character string.`);
    }
    if (undefined !== jsonObj.composite) { // optional
      if (!isObject(jsonObj.composite))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${name} has an invalid composite object.`);
      if (jsonObj.composite.includeZero !== undefined) {
        if (typeof (jsonObj.composite.includeZero) !== "boolean") // includeZero must be a boolean IF it is defined
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${name} has a Composite with an invalid 'includeZero' attribute. It should be of type 'boolean'.`);
      }
      if (jsonObj.composite.spacer !== undefined) {  // spacer must be a string IF it is defined
        if (typeof (jsonObj.composite.spacer) !== "string")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${name} has a Composite with an invalid 'spacer' attribute. It must be of type 'string'.`);
        if (jsonObj.composite.spacer.length !== 1) // spacer must be a one character string
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${name} has a Composite with an invalid 'spacer' attribute. It must be a one character string.`);
      }
      if (jsonObj.composite.units !== undefined) { // if composite is defined, it must be an array with 1-4 units
        if (!Array.isArray(jsonObj.composite.units)) { // must be an array
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${name} has a Composite with an invalid 'units' attribute. It must be of type 'array'`);
        }
        if (jsonObj.composite.units.length <= 0 || jsonObj.composite.units.length > 4) { // Composite requires 1-4 units
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${name} has an invalid 'Composite' attribute. It must have 1-4 units.`);
        }
      } else
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${name} has an invalid 'Composite' attribute. It must have 1-4 units.`); // if you have a composite without any units that is an error
    }
    return jsonObj as FormatProps;
  }

  private isValidPropertyType(type: string): boolean {
    type = type.toLowerCase();
    return (type === "primitiveproperty") ||
      (type === "structproperty") ||
      (type === "primitivearrayproperty") ||
      (type === "structarrayproperty") ||
      (type === "navigationproperty");
  }

  /**
   * Type checks property and returns PropertyProps interface
   * @param jsonObj
   * @param schemaName name of schema
   * @param className name of class
   * @returns PropertyProps
   */
  public parsePropertyProps(jsonObj: unknown, schemaName: string, className: string): PropertyProps {
    if (!isObject(jsonObj))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECProperty in ${schemaName}.${className} is an invalid JSON object.`);

    if (undefined === jsonObj.name)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECProperty in ${schemaName}.${className} does not have the required 'name' attribute.`);
    if (typeof (jsonObj.name) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECProperty in ${schemaName}.${className} has an invalid 'name' attribute. It should be of type 'string'.`);

    const propName = jsonObj.name;

    if (undefined === jsonObj.type)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} does not have the required 'type' attribute.`);
    if (typeof (jsonObj.type) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} has an invalid 'type' attribute. It should be of type 'string'.`);
    if (!this.isValidPropertyType(jsonObj.type))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} has an invalid 'type' attribute. '${jsonObj.type}' is not a valid type.`);

    if (undefined !== jsonObj.label) {
      if (typeof (jsonObj.label) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} has an invalid 'label' attribute. It should be of type 'string'.`);
    }

    if (undefined !== jsonObj.description) {
      if (typeof (jsonObj.description) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} has an invalid 'description' attribute. It should be of type 'string'.`);
    }

    if (undefined !== jsonObj.priority) {
      if (typeof (jsonObj.priority) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} has an invalid 'priority' attribute. It should be of type 'number'.`);
    }

    if (undefined !== jsonObj.isReadOnly) {
      if (typeof (jsonObj.isReadOnly) !== "boolean")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} has an invalid 'isReadOnly' attribute. It should be of type 'boolean'.`);
    }

    if (undefined !== jsonObj.category) {
      if (typeof (jsonObj.category) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} has an invalid 'category' attribute. It should be of type 'string'.`);
    }

    if (undefined !== jsonObj.kindOfQuantity) {
      if (typeof (jsonObj.kindOfQuantity) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} has an invalid 'kindOfQuantity' attribute. It should be of type 'string'.`);
    }

    if (undefined !== jsonObj.inherited) {
      if (typeof (jsonObj.inherited) !== "boolean")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} has an invalid 'inherited' attribute. It should be of type 'boolean'.`);
    }

    if (undefined !== jsonObj.customAttributes) {
      if (!Array.isArray(jsonObj.customAttributes)) {
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} has an invalid 'customAttributes' attribute. It should be of type 'array'.`);
      }
    }
    return jsonObj as PropertyProps;
  }

  /**
   * Type checks PrimitiveOrEnumProperty and returns PrimitiveOrEnumPropertyBaseProps interface
   * @param jsonObj
   * @param schemaName name of schema
   * @param className name of class
   * @returns PrimitiveOrEnumPropertyBaseProps
   */
  public parsePrimitiveOrEnumPropertyBaseProps(jsonObj: unknown, schemaName: string, className: string): PrimitiveOrEnumPropertyBaseProps {
    if (!isObject(jsonObj))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECProperty in ${schemaName}.${className} is an invalid JSON object.`);

    if (undefined === jsonObj.name)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECProperty in ${schemaName}.${className} does not have the required 'name' attribute.`);
    if (typeof (jsonObj.name) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECProperty in ${schemaName}.${className} has an invalid 'name' attribute. It should be of type 'string'.`);

    const propName = jsonObj.name;

    if (undefined === jsonObj.type)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} does not have the required 'type' attribute.`);
    if (typeof (jsonObj.type) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} has an invalid 'type' attribute. It should be of type 'string'.`);
    if (!this.isValidPropertyType(jsonObj.type))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} has an invalid 'type' attribute. '${jsonObj.type}' is not a valid type.`);

    if (undefined !== jsonObj.minLength) {
      if (typeof (jsonObj.minLength) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} has an invalid 'minLength' attribute. It should be of type 'number'.`);
    }

    if (undefined !== jsonObj.maxLength) {
      if (typeof (jsonObj.maxLength) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} has an invalid 'maxLength' attribute. It should be of type 'number'.`);
    }

    if (undefined !== jsonObj.minValue) {
      if (typeof (jsonObj.minValue) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} has an invalid 'minValue' attribute. It should be of type 'number'.`);
    }

    if (undefined !== jsonObj.maxValue) {
      if (typeof (jsonObj.maxValue) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} has an invalid 'maxValue' attribute. It should be of type 'number'.`);
    }

    if (undefined !== jsonObj.extendedTypeName) {
      if (typeof (jsonObj.extendedTypeName) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} has an invalid 'extendedTypeName' attribute. It should be of type 'string'.`);
    }
    return jsonObj as PrimitiveOrEnumPropertyBaseProps;
  }

  /**
   * Type checks PrimitiveProperty and returns PrimitivePropertyProps interface
   * @param jsonObj
   * @param schemaName name of schema
   * @param className name of class
   * @returns PrimitivePropertyProps
   */
  public parsePrimitivePropertyProps(jsonObj: unknown, schemaName: string, className: string): PrimitivePropertyProps {
    if (!isObject(jsonObj))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECProperty in ${schemaName}.${className} is an invalid JSON object.`);

    if (undefined === jsonObj.name)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECProperty in ${schemaName}.${className} does not have the required 'name' attribute.`);
    if (typeof (jsonObj.name) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECProperty in ${schemaName}.${className} has an invalid 'name' attribute. It should be of type 'string'.`);

    const propName = jsonObj.name;

    if (undefined === jsonObj.type)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} does not have the required 'type' attribute.`);
    if (typeof (jsonObj.type) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} has an invalid 'type' attribute. It should be of type 'string'.`);
    if (!this.isValidPropertyType(jsonObj.type))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} has an invalid 'type' attribute. '${jsonObj.type}' is not a valid type.`);

    if (undefined !== jsonObj.typeName) {
      if (typeof (jsonObj.typeName) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} has an invalid 'typeName' attribute. It should be of type 'string'.`);
    }
    return jsonObj as PrimitivePropertyProps;
  }

  /**
   * Type checks StructProperty and returns StructPropertyProps interface
   * @param jsonObj
   * @param schemaName name of schema
   * @param className name of class
   * @returns StructPropertyProps
   */
  public parseStructPropertyProps(jsonObj: unknown, schemaName: string, className: string): StructPropertyProps {
    if (!isObject(jsonObj))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECProperty in ${schemaName}.${className} is an invalid JSON object.`);

    if (undefined === jsonObj.name)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECProperty in ${schemaName}.${className} does not have the required 'name' attribute.`);
    if (typeof (jsonObj.name) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECProperty in ${schemaName}.${className} has an invalid 'name' attribute. It should be of type 'string'.`);

    const propName = jsonObj.name;

    if (undefined === jsonObj.type)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} does not have the required 'type' attribute.`);
    if (typeof (jsonObj.type) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} has an invalid 'type' attribute. It should be of type 'string'.`);
    if (!this.isValidPropertyType(jsonObj.type))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} has an invalid 'type' attribute. '${jsonObj.type}' is not a valid type.`);

    if (undefined !== jsonObj.typeName) {
      if (typeof (jsonObj.typeName) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} has an invalid 'typeName' attribute. It should be of type 'string'.`);
    }
    return jsonObj as StructPropertyProps;
  }

  /**
   * Type checks EnumerationProperty and returns EnumerationPropertyProps interface
   * @param jsonObj
   * @param schemaName name of schema
   * @param className name of class
   * @returns EnumerationPropertyProps
   */
  public parseEnumerationPropertyProps(jsonObj: unknown, schemaName: string, className: string): EnumerationPropertyProps {
    if (!isObject(jsonObj))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECProperty in ${schemaName}.${className} is an invalid JSON object.`);

    if (undefined === jsonObj.name)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECProperty in ${schemaName}.${className} does not have the required 'name' attribute.`);
    if (typeof (jsonObj.name) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECProperty in ${schemaName}.${className} has an invalid 'name' attribute. It should be of type 'string'.`);

    const propName = jsonObj.name;

    if (undefined === jsonObj.type)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} does not have the required 'type' attribute.`);
    if (typeof (jsonObj.type) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} has an invalid 'type' attribute. It should be of type 'string'.`);
    if (!this.isValidPropertyType(jsonObj.type))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} has an invalid 'type' attribute. '${jsonObj.type}' is not a valid type.`);

    if (undefined !== jsonObj.typeName) {
      if (typeof (jsonObj.typeName) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} has an invalid 'typeName' attribute. It should be of type 'string'.`);
    }
    return jsonObj as EnumerationPropertyProps;
  }

  /**
   * Type checks PrimitiveArrayProperty and returns PrimitiveArrayPropertyProps interface
   * @param jsonObj
   * @param schemaName name of schema
   * @param className name of class
   * @returns PrimitiveArrayPropertyProps
   */
  public parsePrimitiveArrayPropertyProps(jsonObj: unknown, schemaName: string, className: string): PrimitiveArrayPropertyProps {
    if (!isObject(jsonObj))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECProperty in ${schemaName}.${className} is an invalid JSON object.`);

    if (undefined === jsonObj.name)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECProperty in ${schemaName}.${className} does not have the required 'name' attribute.`);
    if (typeof (jsonObj.name) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECProperty in ${schemaName}.${className} has an invalid 'name' attribute. It should be of type 'string'.`);

    const propName = jsonObj.name;

    if (undefined === jsonObj.type)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} does not have the required 'type' attribute.`);
    if (typeof (jsonObj.type) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} has an invalid 'type' attribute. It should be of type 'string'.`);
    if (!this.isValidPropertyType(jsonObj.type))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} has an invalid 'type' attribute. '${jsonObj.type}' is not a valid type.`);

    if (undefined !== jsonObj.typeName) {
      if (typeof (jsonObj.typeName) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} has an invalid 'typeName' attribute. It should be of type 'string'.`);
    }
    if (undefined !== jsonObj.minOccurs) {
      if (typeof (jsonObj.minOccurs) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} has an invalid 'minOccurs' attribute. It should be of type 'number'.`);
    }

    if (undefined !== jsonObj.maxOccurs) {
      if (typeof (jsonObj.maxOccurs) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} has an invalid 'maxOccurs' attribute. It should be of type 'number'.`);
    }
    return jsonObj as PrimitiveArrayPropertyProps;
  }

  /**
   * Type checks StructArrayProperty and returns StructArrayPropertyProps interface
   * @param jsonObj
   * @param schemaName name of schema
   * @param className name of class
   * @returns StructArrayPropertyProps
   */
  public parseStructArrayPropertyProps(jsonObj: unknown, schemaName: string, className: string): StructArrayPropertyProps {
    if (!isObject(jsonObj))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECProperty in ${schemaName}.${className} is an invalid JSON object.`);

    if (undefined === jsonObj.name)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECProperty in ${schemaName}.${className} does not have the required 'name' attribute.`);
    if (typeof (jsonObj.name) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECProperty in ${schemaName}.${className} has an invalid 'name' attribute. It should be of type 'string'.`);

    const propName = jsonObj.name;

    if (undefined === jsonObj.type)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} does not have the required 'type' attribute.`);
    if (typeof (jsonObj.type) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} has an invalid 'type' attribute. It should be of type 'string'.`);
    if (!this.isValidPropertyType(jsonObj.type))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} has an invalid 'type' attribute. '${jsonObj.type}' is not a valid type.`);

    if (undefined !== jsonObj.typeName) {
      if (typeof (jsonObj.typeName) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} has an invalid 'typeName' attribute. It should be of type 'string'.`);
    }
    if (undefined !== jsonObj.minOccurs) {
      if (typeof (jsonObj.minOccurs) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} has an invalid 'minOccurs' attribute. It should be of type 'number'.`);
    }

    if (undefined !== jsonObj.maxOccurs) {
      if (typeof (jsonObj.maxOccurs) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} has an invalid 'maxOccurs' attribute. It should be of type 'number'.`);
    }
    return jsonObj as StructArrayPropertyProps;
  }

  /**
   * Type checks NavigationProperty and returns NavigationPropertyProps interface
   * @param jsonObj
   * @param schemaName name of schema
   * @param className name of class
   * @returns NavigationPropertyProps
   */
  public parseNavigationPropertyProps(jsonObj: unknown, name: string, classObj: AnyClass): NavigationPropertyProps {
    if (!isObject(jsonObj))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Navigation Property ${classObj.name}.${name} is an invalid JSON object.`);
    if (classObj.schemaItemType !== SchemaItemType.EntityClass && classObj.schemaItemType !== SchemaItemType.RelationshipClass && classObj.schemaItemType !== SchemaItemType.Mixin)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Navigation Property ${classObj.name}.${name} is invalid, because only EntityClasses, Mixins, and RelationshipClasses can have NavigationProperties.`);
    if (undefined === jsonObj.relationshipName)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Navigation Property ${classObj.name}.${name} is missing the required 'relationshipName' property.`);
    if (typeof (jsonObj.relationshipName) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Navigation Property ${classObj.name}.${name} has an invalid 'relationshipName' property. It should be of type 'string'.`);

    if (undefined === jsonObj.direction)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Navigation Property ${classObj.name}.${name} is missing the required 'direction' property.`);
    if (typeof (jsonObj.direction) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Navigation Property ${classObj.name}.${name} has an invalid 'direction' property. It should be of type 'string'.`);

    return jsonObj as NavigationPropertyProps;
  }

  /**
   * Type checks PropertyTypes and returns PropertyProps interface
   * @param jsonObj
   * @param schemaName name of schema
   * @param className name of class
   * @returns PropertyProps
   */
  public parsePropertyTypes(jsonObj: unknown, schemaName: string, className: string): PropertyProps {
    if (!isObject(jsonObj))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECProperty in ${schemaName}.${className} is an invalid JSON object.`);
    if (undefined === jsonObj.name)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECProperty in ${schemaName}.${className} is missing the required 'name' property.`);
    if (typeof (jsonObj.name) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECProperty in ${schemaName}.${className} has an invalid 'name' property. It should be of type 'string'.`);

    const propName = jsonObj.name;

    if (undefined === jsonObj.type)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} is missing the required 'type' property.`);
    if (typeof (jsonObj.type) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} has an invalid 'type' property. It should be of type 'string'.`);
    if (jsonObj.type.toLowerCase() !== "navigationproperty") { // type name is required for all properties except Navigation Property
      if (undefined === jsonObj.typeName)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} is missing the required 'typeName' property.`);
      if (typeof (jsonObj.typeName) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${schemaName}.${className}.${propName} has an invalid 'typeName' property. It should be of type 'string'.`);
    }
    return jsonObj as PropertyProps;
  }
}
