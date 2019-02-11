/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

import { Guid } from "@bentley/bentleyjs-core";
import { Ruleset } from "./rules/Ruleset";
import { Field, PropertiesField } from "./content/Fields";
import Item from "./content/Item";
import { RuleTypes } from "./rules/Rule";
import { RuleSpecificationTypes } from "./rules/RuleSpecification";
import { Value, isNestedContentValue, DisplayValue } from "./content/Value";
import { MultiSchemaClassesSpecification, SingleSchemaClassSpecification } from "./rules/ClassSpecifications";
import { PropertyValueFormat } from "./content/TypeDescription";
import { ClassInfo, RelatedClassInfo } from "./EC";
import { RelatedInstanceSpecification } from "./rules/RelatedInstanceSpecification";
import { RelationshipDirection } from "./rules/RelationshipDirection";

/**
 * A factory class that can be used to create presentation rulesets targeted towards
 * specific use cases.
 */
export class RulesetsFactory {
  /**
   * Create a ruleset with content rules for getting instances are of the
   * same ECClass and have the same property value as the provided `record`.
   * @param field A field identifying which property of the record we should use
   * @param record A record whose similar instances should be found
   */
  public createSimilarInstancesRuleset(field: Field, record: Item): { ruleset: Ruleset, description: string } {
    if (!field.isPropertiesField())
      throw new Error("Can only create 'similar instances' ruleset for properties-based records");
    if (field.type.valueFormat !== PropertyValueFormat.Primitive)
      throw new Error("Can only create 'similar instances' ruleset for primitive properties");
    if (field.properties.length === 0)
      throw new Error("Invalid properties' field with no properties");
    if (record.isFieldMerged(field.name))
      throw new Error("Can't create 'similar instances' ruleset for merged values");
    if (!record.classInfo)
      throw new Error("Can't create 'similar instances' for records based on multiple different ECClass instances");
    const propertyName = getPropertyName(field);
    const propertyValue = getPropertyValue(record, field);
    const relatedInstances = createRelatedInstanceSpecs(field);
    const relatedInstanceSpecs = relatedInstances.map((r) => r.spec);
    const ruleset: Ruleset = {
      id: `SimilarInstances/${propertyName}/${Guid.createValue()}`,
      rules: [],
    };
    ruleset.rules.push({
      ruleType: RuleTypes.Content,
      specifications: [{
        specType: RuleSpecificationTypes.ContentInstancesOfSpecificClasses,
        classes: createMultiClassSpecification(record.classInfo),
        arePolymorphic: true,
        relatedInstances: relatedInstanceSpecs,
        instanceFilter: createInstanceFilter(relatedInstanceSpecs, propertyName, propertyValue.v),
      }],
    });
    const description = createDescription(record, relatedInstances.map((r) => r.class), field, propertyValue.d);
    return { ruleset, description };
  }
}

const createDescription = (record: Item, relatedClasses: ClassInfo[], field: Field, value: string): string => {
  const classes = (relatedClasses.length > 0) ? relatedClasses : [record.classInfo!];
  return classes.reduce((descr, classInfo, index) => {
    if (index !== 0)
      descr += " OR ";
    descr += `[${classInfo.label}].[${field.label}] = ${value}`;
    return descr;
  }, "");
};

const getPropertyName = (field: PropertiesField): string => {
  let name = field.properties[0].property.name;
  if (field.type.typeName === "navigation")
    name += ".Id";
  return name;
};

const toString = (displayValue: DisplayValue): string => {
  if (!displayValue)
    return "NULL";
  return displayValue.toString();
};

const getPropertyValue = (record: Item, field: Field): { v: Value, d: string } => {
  const fieldNamesStack = [];
  let currField: Field | undefined = field;
  while (currField) {
    fieldNamesStack.push(currField.name);
    currField = currField.parent;
  }
  let currFieldName = fieldNamesStack.pop();
  let displayValue: DisplayValue = record.displayValues[currFieldName!];
  let value: Value = record.values[currFieldName!];
  currFieldName = fieldNamesStack.pop();
  while (currFieldName) {
    if (!isNestedContentValue(value) || value.length === 0)
      throw new Error("Invalid record value");
    if (value.length > 1)
      throw new Error("Can't create 'similar instances' for records related through many part of *-to-many relationship");
    if (value[0].mergedFieldNames.indexOf(currFieldName) !== -1)
      throw new Error("Can't create 'similar instances' ruleset for merged values");
    displayValue = value[0].displayValues[currFieldName];
    value = value[0].values[currFieldName];
    currFieldName = fieldNamesStack.pop();
  }
  return { v: value, d: toString(displayValue) };
};

const createInstanceFilter = (relatedInstances: Array<Readonly<RelatedInstanceSpecification>>, propertyName: string, propertyValue: Value): string => {
  const aliases = relatedInstances.map((relatedInstanceSpec) => relatedInstanceSpec.alias);
  if (aliases.length === 0)
    aliases.push("this");
  return aliases.reduce((filter: string, alias: string, index: number): string => {
    if (index !== 0)
      filter += " OR ";
    filter += createComparison(`${alias}.${propertyName}`, "=", propertyValue);
    return filter;
  }, "");
};

type Operator = "=" | "!=" | ">" | ">=" | "<" | "<=";
const createComparison = (name: string, operator: Operator, value: Value): string => {
  let compareValue: string;
  if (typeof value === "undefined")
    compareValue = "NULL";
  else if (typeof value === "string")
    compareValue = `"${value}"`;
  else if (typeof value === "boolean")
    compareValue = value ? "TRUE" : "FALSE";
  else if (typeof value === "number")
    compareValue = value.toString();
  else
    throw new Error("Unsupported value format");
  return `${name} ${operator} ${compareValue}`;
};

const createMultiClassSpecification = (classInfo: Readonly<ClassInfo>): MultiSchemaClassesSpecification => {
  const [schemaName, className] = classInfo.name.split(":");
  return { schemaName, classNames: [className] };
};

const createSingleClassSpecification = (classInfo: Readonly<ClassInfo>): SingleSchemaClassSpecification => {
  const [schemaName, className] = classInfo.name.split(":");
  return { schemaName, className };
};

const createRelatedInstanceSpec = (relatedClassInfo: RelatedClassInfo, index: number): { spec: RelatedInstanceSpecification, class: ClassInfo } => ({
  spec: {
    relationship: createSingleClassSpecification(relatedClassInfo.relationshipInfo),
    class: createSingleClassSpecification(relatedClassInfo.isForwardRelationship ? relatedClassInfo.targetClassInfo : relatedClassInfo.sourceClassInfo),
    requiredDirection: relatedClassInfo.isForwardRelationship ? RelationshipDirection.Backward : RelationshipDirection.Forward,
    isRequired: true,
    alias: `related_${index}`,
  },
  class: relatedClassInfo.isForwardRelationship ? relatedClassInfo.targetClassInfo : relatedClassInfo.sourceClassInfo,
});

const createRelatedInstanceSpecs = (field: PropertiesField): Array<{ spec: RelatedInstanceSpecification, class: ClassInfo }> => {
  const specs = new Array();
  field.properties.forEach((property, index) => {
    if (property.relatedClassPath.length === 0) {
      // not related
      return;
    }
    if (property.relatedClassPath.length > 1) {
      // RelatedInstance presentation rule doesn't support multiple step relationships yet
      throw new Error("Can't create related instance specification for property related through multiple relationships");
    }
    specs.push(createRelatedInstanceSpec(property.relatedClassPath[0], index));
  });
  if (field.parent) {
    if (specs.length > 0) {
      // note: should prepend field.parent.pathToPrimaryClass to every spec, but
      // RelatedInstance presentation rule doesn't support multiple step relationships yet
      throw new Error("Can't create related instance specification for property related through multiple relationships");
    }
    if (field.parent.pathToPrimaryClass.length === 0) {
      throw new Error("Expecting nested fields to always have relationship path to primary class");
    }
    if (field.parent.pathToPrimaryClass.length > 1) {
      // RelatedInstance presentation rule doesn't support multiple step relationships yet
      throw new Error("Can't create related instance specification for property related through multiple relationships");
    }
    specs.push(createRelatedInstanceSpec(field.parent.pathToPrimaryClass[0], 0));
  }
  return specs;
};
