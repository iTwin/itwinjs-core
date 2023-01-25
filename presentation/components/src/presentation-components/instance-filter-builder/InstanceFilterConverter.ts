/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module InstancesFilter
 */

import { Primitives, PrimitiveValue } from "@itwin/appui-abstract";
import { isUnaryPropertyFilterOperator, PropertyFilterRuleGroupOperator, PropertyFilterRuleOperator } from "@itwin/components-react";
import { IModelConnection } from "@itwin/core-frontend";
import { ClassInfo, InstanceFilterDefinition, NestedContentField, PropertiesField, PropertyInfo, RelationshipPath } from "@itwin/presentation-common";
import { getIModelMetadataProvider } from "./ECMetadataProvider";
import { PresentationInstanceFilter, PresentationInstanceFilterCondition, PresentationInstanceFilterConditionGroup } from "./Types";

/**
 * Converts [[PresentationInstanceFilter]] built by [[PresentationInstanceFilterBuilder]] component into
 * [InstanceFilterDefinition]($presentation-common) that can be passed to [PresentationManager]($presentation-frontend) through request options
 * in order to filter results.
 * @beta
 */
export async function convertToInstanceFilterDefinition(filter: PresentationInstanceFilter, imodel: IModelConnection): Promise<InstanceFilterDefinition> {
  const context: ConvertContext = { relatedInstances: [], propertyClasses: [] };
  const expression = convertFilter(filter, context);

  const baseClass = await findBaseExpressionClass(imodel, context.propertyClasses);

  return {
    expression,
    selectClassName: baseClass.name,
    relatedInstances: context.relatedInstances.map((related) => ({
      pathFromSelectToPropertyClass: RelationshipPath.strip(related.path),
      alias: related.alias,
    })),
  };
}

interface RelatedInstanceDescription {
  path: RelationshipPath;
  alias: string;
}

interface ConvertContext {
  relatedInstances: RelatedInstanceDescription[];
  propertyClasses: ClassInfo[];
}

function convertFilter(filter: PresentationInstanceFilter, ctx: ConvertContext) {
  if (isFilterConditionGroup(filter))
    return convertConditionGroup(filter, ctx);
  return convertCondition(filter, ctx);
}

function convertConditionGroup(group: PresentationInstanceFilterConditionGroup, ctx: ConvertContext): string {
  const convertedConditions = group.conditions.map((condition) => convertFilter(condition, ctx));
  return `(${convertedConditions.join(` ${getGroupOperatorString(group.operator)} `)})`;
}

function convertCondition(condition: PresentationInstanceFilterCondition, ctx: ConvertContext): string {
  const { field, operator, value } = condition;
  const property = field.properties[0].property;
  const relatedInstance = getRelatedInstanceDescription(field, property.classInfo.name, ctx);
  addClassInfoToContext(relatedInstance ? relatedInstance.path[0].sourceClassInfo : property.classInfo, ctx);
  const propertyAlias = relatedInstance?.alias ?? "this";

  return createComparison(property.name, field.type.typeName, propertyAlias, operator, value);
}

function addClassInfoToContext(classInfo: ClassInfo, ctx: ConvertContext) {
  if (ctx.propertyClasses.find((existing) => existing.id === classInfo.id))
    return;

  ctx.propertyClasses.push(classInfo);
}

function getRelatedInstanceDescription(field: PropertiesField, propClassName: string, ctx: ConvertContext): RelatedInstanceDescription | undefined {
  if (!field.parent)
    return undefined;

  const pathToProperty = RelationshipPath.reverse(getPathToPrimaryClass(field.parent));
  const existing = ctx.relatedInstances.find((instance) => RelationshipPath.equals(pathToProperty, instance.path));
  if (existing)
    return existing;

  const newRelated = {
    path: pathToProperty,
    alias: `rel_${propClassName.split(":")[1]}`,
  };

  ctx.relatedInstances.push(newRelated);
  return newRelated;
}

function getPathToPrimaryClass(field: NestedContentField): RelationshipPath {
  if (field.parent) {
    return [...field.pathToPrimaryClass, ...getPathToPrimaryClass(field.parent)];
  }
  return [...field.pathToPrimaryClass];
}

function createComparison(propertyName: string, type: string, alias: string, operator: PropertyFilterRuleOperator, propValue?: PrimitiveValue): string {
  const propertyAccessor = `${alias}.${propertyName}`;
  const operatorExpression = getRuleOperatorString(operator);
  if (propValue === undefined || isUnaryPropertyFilterOperator(operator)) {
    return `${propertyAccessor} ${operatorExpression}`;
  }

  const value = propValue.value;
  if (operator === PropertyFilterRuleOperator.Like && typeof value === "string") {
    return `${propertyAccessor} ${operatorExpression} "%${escapeString(value)}%"`;
  }

  let valueExpression = "";
  switch (typeof value) {
    case "string":
      valueExpression = `"${escapeString(value)}"`;
      break;
    case "number":
      valueExpression = value.toString();
      break;
  }

  if (type === "navigation")
    return `${propertyAccessor}.Id ${operatorExpression} ${(value as Primitives.InstanceKey).id}`;
  if (type === "double")
    return `CompareDoubles(${propertyAccessor}, ${valueExpression}) ${operatorExpression} 0`;
  if (type === "dateTime")
    return `CompareDateTimes(${propertyAccessor}, ${valueExpression}) ${operatorExpression} 0`;

  return `${propertyAccessor} ${operatorExpression} ${valueExpression}`;
}

function getGroupOperatorString(operator: PropertyFilterRuleGroupOperator) {
  switch (operator) {
    case PropertyFilterRuleGroupOperator.And:
      return "AND";
    case PropertyFilterRuleGroupOperator.Or:
      return "OR";
    default:
      throw new Error(`Invalid PropertyFilterRuleGroupOperator encountered: ${operator}`);
  }
}

function getRuleOperatorString(operator: PropertyFilterRuleOperator) {
  switch (operator) {
    case PropertyFilterRuleOperator.Greater:
      return ">";
    case PropertyFilterRuleOperator.GreaterOrEqual:
      return ">=";
    case PropertyFilterRuleOperator.IsEqual:
      return "=";
    case PropertyFilterRuleOperator.IsFalse:
      return "IS FALSE";
    case PropertyFilterRuleOperator.IsNotEqual:
      return "<>";
    case PropertyFilterRuleOperator.IsNotNull:
      return "IS NOT NULL";
    case PropertyFilterRuleOperator.IsNull:
      return "IS NULL";
    case PropertyFilterRuleOperator.IsTrue:
      return "IS TRUE";
    case PropertyFilterRuleOperator.Less:
      return "<";
    case PropertyFilterRuleOperator.LessOrEqual:
      return "<=";
    case PropertyFilterRuleOperator.Like:
      return "~";
    default:
      throw new Error(`Invalid PropertyFilterRuleOperator encountered: ${operator}`);
  }
}

function escapeString(str: string) {
  return str.replace(/"/g, `""`);
}

function isFilterConditionGroup(obj: PresentationInstanceFilter): obj is PresentationInstanceFilterConditionGroup {
  return (obj as PresentationInstanceFilterConditionGroup).conditions !== undefined;
}

async function findBaseExpressionClass(imodel: IModelConnection, propertyClasses: ClassInfo[]) {
  if (propertyClasses.length === 1)
    return propertyClasses[0];

  const metadataProvider = getIModelMetadataProvider(imodel);
  const [firstClass, ...restClasses] = propertyClasses;
  let currentBaseClass = firstClass;
  for (const propClass of restClasses) {
    const propClassInfo = await metadataProvider.getECClassInfo(propClass.id);
    if (propClassInfo && propClassInfo.isDerivedFrom(currentBaseClass.id)) {
      currentBaseClass = propClass;
    }
  }
  return currentBaseClass;
}
