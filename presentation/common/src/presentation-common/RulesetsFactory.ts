/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import type { Id64String } from "@itwin/core-bentley";
import { Guid, Id64 } from "@itwin/core-bentley";
import type { Field, PropertiesField } from "./content/Fields";
import type { Item } from "./content/Item";
import type { PrimitiveTypeDescription} from "./content/TypeDescription";
import { PropertyValueFormat } from "./content/TypeDescription";
import type { DisplayValue} from "./content/Value";
import { Value } from "./content/Value";
import type { ClassInfo, InstanceKey} from "./EC";
import { RelationshipPath } from "./EC";
import type { MultiSchemaClassesSpecification, SingleSchemaClassSpecification } from "./rules/ClassSpecifications";
import { ContentSpecificationTypes } from "./rules/content/ContentSpecification";
import type { RelatedInstanceSpecification } from "./rules/RelatedInstanceSpecification";
import { RelationshipDirection } from "./rules/RelationshipDirection";
import { RuleTypes } from "./rules/Rule";
import type { Ruleset } from "./rules/Ruleset";

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
    const relatedInstanceInfo = createRelatedInstanceSpecInfo(field);
    const relatedClass = relatedInstanceInfo?.class;
    const ruleset: Ruleset = {
      id: `SimilarInstances/${propertyName}/${Guid.createValue()}`,
      rules: [],
    };
    ruleset.rules.push({
      ruleType: RuleTypes.Content,
      specifications: [{
        specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
        classes: createMultiClassSpecification(record.classInfo),
        handleInstancesPolymorphically: true,
        relatedInstances: relatedInstanceInfo ? [relatedInstanceInfo.spec] : [],
        instanceFilter: createInstanceFilter(relatedInstanceInfo?.spec, field.type, propertyName, propertyValue.raw),
      }],
    });
    return { ruleset, relatedClass, propertyName, propertyValue };
  }

  /**
   * Create a ruleset with content rules for getting instances are of the
   * same ECClass and have the same property value as the provided `record`.
   * @param field A field identifying which property of the record we should use
   * @param record A record whose similar instances should be found
   * @param computeDisplayValue Optional callback function to calculate display value that's
   * used in ruleset's description. If not provided, display value from record is used instead.
   */
  public async createSimilarInstancesRuleset(field: Field, record: Item, computeDisplayValue?: ComputeDisplayValueCallback): Promise<{ ruleset: Ruleset, description: string }> {
    const info = this.createSimilarInstancesRulesetInfo(field, record);
    const description = await createDescriptionAsync(record, info.relatedClass, field, info.propertyValue, computeDisplayValue);
    return { ruleset: info.ruleset, description };
  }
}

/**
 * Definition of a function for calculating a display value.
 * @public
 */
export type ComputeDisplayValueCallback = (type: string, value: PrimitivePropertyValue, displayValue: string) => Promise<string>;

interface PrimitiveValueDef {
  raw: PrimitivePropertyValue;
  display: string;
}

/**
 * Value of a primitive property.
 * @public
 */
export type PrimitivePropertyValue = string | number | boolean | Point | InstanceKey | undefined;

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type Point = { x: number, y: number, z?: number };

const toString = (displayValue: Value | DisplayValue): string => {
  if (!displayValue)
    return "NULL";
  return displayValue.toString();
};

const createDescription = (record: Item, relatedClass: ClassInfo | undefined, field: Field, value: string): string => {
  const classInfo = relatedClass ?? record.classInfo!;
  return `[${classInfo.label}].[${field.label}] = ${value}`;
};

const createDescriptionAsync = async (record: Item, relatedClass: ClassInfo | undefined, field: Field, value: PrimitiveValueDef, computeDisplayValue?: ComputeDisplayValueCallback): Promise<string> => {
  const displayValue = computeDisplayValue ? await computeDisplayValue(field.type.typeName, value.raw, value.display) : toString(value.display);
  return createDescription(record, relatedClass, field, displayValue);
};

const getPropertyName = (field: PropertiesField) => {
  let name = field.properties[0].property.name;
  if (field.type.typeName === "navigation")
    name += ".Id";
  return name;
};

const isPrimitivePropertyValue = (value: Value): value is PrimitivePropertyValue => {
  if (Value.isPrimitive(value)) {
    return true;
  }

  if (Value.isMap(value)) {
    if (typeof value.x === "number"
      && typeof value.y === "number"
      && (value.z === undefined || typeof value.z === "number")) {
      return true;
    }

    if (typeof value.className === "string" && typeof value.id === "string") {
      return true;
    }
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

const createInstanceFilter = (
  relatedInstanceSpec: Readonly<RelatedInstanceSpecification> | undefined,
  propertyType: PrimitiveTypeDescription,
  propertyName: string,
  propertyValue: PrimitivePropertyValue,
): string => {
  const alias = relatedInstanceSpec ? relatedInstanceSpec.alias : "this";
  return createComparison(propertyType, `${alias}.${propertyName}`, "=", propertyValue);
};

type Operator = "=" | "!=" | ">" | ">=" | "<" | "<=";
const createComparison = (type: PrimitiveTypeDescription, name: string, operator: Operator, value: PrimitivePropertyValue): string => {
  let compareValue = "";
  switch (typeof value) {
    case "undefined": compareValue = "NULL"; break;
    case "string": compareValue = `"${value.replace(/"/g, `""`)}"`; break;
    case "boolean": compareValue = value ? "TRUE" : "FALSE"; break;
    case "number": compareValue = value.toString(); break;
  }
  if (type.typeName === "navigation" && typeof value === "object" && Id64.isId64((value as InstanceKey).id)) {
    // note: this is temporary until we support hex ids in instance filters
    compareValue = hexToDec((value as InstanceKey).id);
  }
  if (type.typeName === "point2d" || type.typeName === "point3d") {
    if (typeof value !== "object")
      throw new Error("Expecting point values to be supplied as objects");
    const dimensionType: PrimitiveTypeDescription = {
      valueFormat: PropertyValueFormat.Primitive,
      typeName: "double",
    };
    const pointValue = value as Point;
    let comparison = `${createComparison(dimensionType, `${name}.x`, operator, pointValue.x)}`;
    comparison += ` AND ${createComparison(dimensionType, `${name}.y`, operator, pointValue.y)}`;
    if (type.typeName === "point3d" && pointValue.z !== undefined)
      comparison += ` AND ${createComparison(dimensionType, `${name}.z`, operator, pointValue.z)}`;
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

const createRelatedInstanceSpec = (pathFromSelectToPropertyClass: RelationshipPath, index: number): { spec: RelatedInstanceSpecification, class: ClassInfo } => ({
  spec: {
    relationshipPath: pathFromSelectToPropertyClass.map((step) => ({
      relationship: createSingleClassSpecification(step.relationshipInfo),
      direction: step.isForwardRelationship ? RelationshipDirection.Forward : RelationshipDirection.Backward,
      targetClass: createSingleClassSpecification(step.targetClassInfo),
    })),
    isRequired: true,
    alias: `related_${index}`,
  },
  class: pathFromSelectToPropertyClass[pathFromSelectToPropertyClass.length - 1].targetClassInfo,
});

const createPathFromSelectToPropertyClass = (field: PropertiesField): RelationshipPath => {
  let currField: Field = field;
  const pathFromPropertyToSelectClass: RelationshipPath = [];
  while (currField.parent) {
    pathFromPropertyToSelectClass.push(...currField.parent.pathToPrimaryClass);
    currField = currField.parent;
  }
  return RelationshipPath.reverse(pathFromPropertyToSelectClass);
};

const createRelatedInstanceSpecInfo = (field: PropertiesField): { spec: RelatedInstanceSpecification, class: ClassInfo } | undefined => {
  const path = createPathFromSelectToPropertyClass(field);
  return path.length ? createRelatedInstanceSpec(path, 0) : undefined;
};

const hexToDec = (id: Id64String) => {
  const digits = [0];
  for (let i = 2; i < id.length; ++i) {
    let carry = parseInt(id.charAt(i), 16);
    for (let j = 0; j < digits.length; ++j) {
      digits[j] = digits[j] * 16 + carry;
      carry = digits[j] / 10 | 0;
      digits[j] %= 10;
    }
    while (carry > 0) {
      digits.push(carry % 10);
      carry = carry / 10 | 0;
    }
  }
  return digits.reverse().join("");
};
