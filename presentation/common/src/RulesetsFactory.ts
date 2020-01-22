/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { Guid } from "@bentley/bentleyjs-core";
import { Ruleset } from "./rules/Ruleset";
import { Field, PropertiesField } from "./content/Fields";
import { Item } from "./content/Item";
import { RuleTypes } from "./rules/Rule";
import { ContentSpecificationTypes } from "./rules/content/ContentSpecification";
import { Value, DisplayValue } from "./content/Value";
import { MultiSchemaClassesSpecification, SingleSchemaClassSpecification } from "./rules/ClassSpecifications";
import { PropertyValueFormat, PrimitiveTypeDescription } from "./content/TypeDescription";
import { ClassInfo, RelatedClassInfo } from "./EC";
import { RelatedInstanceSpecification } from "./rules/RelatedInstanceSpecification";
import { RelationshipDirection } from "./rules/RelationshipDirection";

/**
 * A factory class that can be used to create presentation rulesets targeted towards
 * specific use cases.
 *
 * @public
 */
export class RulesetsFactory {
  private createSimilarInstancesRulesetInfo(field: Field, record: Item) {
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
    const relatedClasses = relatedInstances.map((r) => r.class);
    const relatedInstanceSpecs = relatedInstances.map((r) => r.spec);
    const ruleset: Ruleset = {
      id: `SimilarInstances/${propertyName}/${Guid.createValue()}`,
      rules: [],
    };
    ruleset.rules.push({
      ruleType: RuleTypes.Content,
      specifications: [{
        specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
        classes: createMultiClassSpecification(record.classInfo),
        arePolymorphic: true,
        relatedInstances: relatedInstanceSpecs,
        instanceFilter: createInstanceFilter(relatedInstanceSpecs, field.type, propertyName, propertyValue.raw),
      }],
    });
    return { ruleset, relatedClasses, propertyName, propertyValue };
  }

  /**
   * Create a ruleset with content rules for getting instances are of the
   * same ECClass and have the same property value as the provided `record`.
   * @param field A field identifying which property of the record we should use
   * @param record A record whose similar instances should be found
   * @deprecated Use `createSimilarInstancesRulesetAsync` instead
   */
  public createSimilarInstancesRuleset(field: Field, record: Item): { ruleset: Ruleset, description: string } {
    const info = this.createSimilarInstancesRulesetInfo(field, record);
    const description = createDescription(record, info.relatedClasses, field, info.propertyValue.display);
    return { ruleset: info.ruleset, description };
  }

  /**
   * Create a ruleset with content rules for getting instances are of the
   * same ECClass and have the same property value as the provided `record`.
   * @param field A field identifying which property of the record we should use
   * @param record A record whose similar instances should be found
   * @param computeDisplayValue Optional callback function to calculate display value that's
   * used in ruleset's description. If not provided, display value from record is used instead.
   * @note Will be renamed to `createSimilarInstancesRuleset` on next major version change.
   */
  public async createSimilarInstancesRulesetAsync(field: Field, record: Item, computeDisplayValue?: ComputeDisplayValueCallback): Promise<{ ruleset: Ruleset, description: string }> {
    const info = this.createSimilarInstancesRulesetInfo(field, record);
    const description = await createDescriptionAsync(record, info.relatedClasses, field, info.propertyValue, computeDisplayValue);
    return { ruleset: info.ruleset, description };
  }
}

/**
 * Definition of a function for calculating a display value.
 * @public
 */
export type ComputeDisplayValueCallback = (type: string, value: string | number | boolean | { x: number, y: number, z?: number } | undefined, displayValue: string) => Promise<string>;

interface PrimitiveValueDef {
  raw: string | number | boolean | { x: number, y: number, z?: number } | undefined;
  display: string;
}

const toString = (displayValue: Value | DisplayValue): string => {
  if (!displayValue)
    return "NULL";
  return displayValue.toString();
};

const createDescription = (record: Item, relatedClasses: ClassInfo[], field: Field, value: string): string => {
  const classes = (relatedClasses.length > 0) ? relatedClasses : [record.classInfo!];
  return classes.reduce((descr, classInfo, index) => {
    if (index !== 0)
      descr += " OR ";
    descr += `[${classInfo.label}].[${field.label}] = ${value}`;
    return descr;
  }, "");
};

const createDescriptionAsync = async (record: Item, relatedClasses: ClassInfo[], field: Field, value: PrimitiveValueDef, computeDisplayValue?: ComputeDisplayValueCallback): Promise<string> => {
  const displayValue = computeDisplayValue ? await computeDisplayValue(field.type.typeName, value.raw, value.display) : toString(value.display);
  return createDescription(record, relatedClasses, field, displayValue);
};

const getPropertyName = (field: PropertiesField) => {
  let name = field.properties[0].property.name;
  if (field.type.typeName === "navigation")
    name += ".Id";
  return name;
};

const isPrimitivePropertyValue = (value: Value): value is string | number | boolean | { x: number, y: number, z?: number } | undefined => {
  if (Value.isPrimitive(value))
    return true;
  if (Value.isMap(value)
    && value.x && typeof value.x === "number"
    && value.y && typeof value.y === "number"
    && (!value.z || typeof value.z === "number")) {
    return true;
  }
  return false;
};

const getPropertyValue = (record: Item, field: Field): PrimitiveValueDef => {
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
    if (!Value.isNestedContent(value) || value.length === 0)
      throw new Error("Invalid record value");
    if (value.length > 1)
      throw new Error("Can't create 'similar instances' for records related through many part of *-to-many relationship");
    if (value[0].mergedFieldNames.indexOf(currFieldName) !== -1)
      throw new Error("Can't create 'similar instances' ruleset for merged values");
    displayValue = value[0].displayValues[currFieldName];
    value = value[0].values[currFieldName];
    currFieldName = fieldNamesStack.pop();
  }
  if (!isPrimitivePropertyValue(value))
    throw new Error("Can only create 'similar instances' ruleset for primitive values");
  return { raw: value, display: toString(displayValue) };
};

const createInstanceFilter = (relatedInstances: Array<Readonly<RelatedInstanceSpecification>>, propertyType: PrimitiveTypeDescription, propertyName: string, propertyValue: string | number | boolean | { x: number, y: number, z?: number } | undefined): string => {
  const aliases = relatedInstances.map((relatedInstanceSpec) => relatedInstanceSpec.alias);
  if (aliases.length === 0)
    aliases.push("this");
  return aliases.reduce((filter: string, alias: string, index: number): string => {
    if (index !== 0)
      filter += " OR ";
    filter += createComparison(propertyType, `${alias}.${propertyName}`, "=", propertyValue);
    return filter;
  }, "");
};

type Operator = "=" | "!=" | ">" | ">=" | "<" | "<=";
const createComparison = (type: PrimitiveTypeDescription, name: string, operator: Operator, value: string | number | boolean | { x: number, y: number, z?: number } | undefined): string => {
  let compareValue = "";
  switch (typeof value) {
    case "undefined": compareValue = "NULL"; break;
    case "string": compareValue = `"${value.replace(/"/g, `""`)}"`; break;
    case "boolean": compareValue = value ? "TRUE" : "FALSE"; break;
    case "number": compareValue = value.toString(); break;
  }
  if (type.typeName === "point2d" || type.typeName === "point3d") {
    if (typeof value !== "object")
      throw new Error("Expecting point values to be supplied as objects");
    const dimensionType: PrimitiveTypeDescription = {
      valueFormat: PropertyValueFormat.Primitive,
      typeName: "double",
    };
    let comparison = `${createComparison(dimensionType, `${name}.x`, operator, value.x)}`;
    comparison += ` AND ${createComparison(dimensionType, `${name}.y`, operator, value.y)}`;
    if (type.typeName === "point3d" && value.z !== undefined)
      comparison += ` AND ${createComparison(dimensionType, `${name}.z`, operator, value.z)}`;
    return comparison;
  }
  if (type.typeName === "double") {
    return `CompareDoubles(${name}, ${compareValue}) ${operator} 0`;
  }
  if (type.typeName === "dateTime") {
    return `CompareDateTimes(${name}, ${compareValue}) ${operator} 0`;
  }
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
