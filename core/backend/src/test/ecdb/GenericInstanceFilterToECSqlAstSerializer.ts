/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { GenericInstanceFilter, GenericInstanceFilterRelatedInstanceDescription, GenericInstanceFilterRule, GenericInstanceFilterRuleGroup, GenericInstanceFilterRuleValue } from "@itwin/core-common";
import { BinaryBooleanExpr, BooleanExpr, ClassNameExpr, ClassRefExpr, DerivedPropertyExpr, FromClauseExpr, IsNullExpr, JoinType, LikeExpr, LiteralExpr, LiteralValueType, PropertyNameExpr, QualifiedJoinExpr, SelectExpr, SelectionClauseExpr, SelectStatementExpr, WhereClauseExp } from "@itwin/ecsql-common";
import { PropertyFilterRuleGroupOperator } from "./PropertyFilter";

export class GenericInstanceFilterToECSqlAstSerializer {
  private static getSchemaNameOrAlias(name: string) {
    return name.split(":")[0] ?? "";
  }

  private static getClassName(name: string) {
    return name.split(":")[1] ?? "";
  }

  private static serializeRelationships(relatedInstances: GenericInstanceFilterRelatedInstanceDescription[], first: ClassRefExpr): FromClauseExpr {
    let previousClassRef = first;
    for (let j = 0; j < relatedInstances.length; j++) {
      const related = relatedInstances[j];
      const alias = related.alias;
      const relatedPath = related.path;
      let prevAlias = "this";
      for (let i = 0; i < relatedPath.length; i++) {
        const step = relatedPath[i];
        const stepAlias = i + 1 === relatedPath.length ? alias : `class_${j}_${i}`;
        const relAlias = `rel_${j}_${i}`;
        const relSourcePropName = step.isForwardRelationship ? "SourceECInstanceId" : "TargetECInstanceId";
        const relTargetPropName = step.isForwardRelationship ? "TargetECInstanceId" : "SourceECInstanceId";
        previousClassRef = new QualifiedJoinExpr(
          JoinType.Inner,
          previousClassRef,
          new ClassNameExpr(
            GenericInstanceFilterToECSqlAstSerializer.getSchemaNameOrAlias(step.relationshipClassName),
            GenericInstanceFilterToECSqlAstSerializer.getClassName(step.relationshipClassName),
            undefined,
            relAlias),
          new BinaryBooleanExpr(
            "=",
            new PropertyNameExpr(`${relAlias}.${relSourcePropName}`),
            new PropertyNameExpr(`${prevAlias}.ECInstanceId`)),
        );

        previousClassRef = new QualifiedJoinExpr(
          JoinType.Inner,
          previousClassRef,
          new ClassNameExpr(
            GenericInstanceFilterToECSqlAstSerializer.getSchemaNameOrAlias(step.targetClassName),
            GenericInstanceFilterToECSqlAstSerializer.getClassName(step.targetClassName),
            undefined,
            stepAlias),
          new BinaryBooleanExpr(
            "=",
            new PropertyNameExpr(`${relAlias}.${relTargetPropName}`),
            new PropertyNameExpr(`${stepAlias}.ECInstanceId`)),
        );
        prevAlias = stepAlias;
      }
    }
    return new FromClauseExpr([previousClassRef ?? first]);
  }

  private static serializeRuleValue(value: GenericInstanceFilterRuleValue.Values) {
    if (GenericInstanceFilterRuleValue.isInstanceKey(value)) {
      return new LiteralExpr(LiteralValueType.Raw, value.id);
    } else if (typeof value === "number") {
      return LiteralExpr.makeNumber(Number(value.toFixed(3)));
    }
    return new LiteralExpr(LiteralValueType.String, value as string);
  }

  private static serializeRuleGroup(group: GenericInstanceFilterRuleGroup): BooleanExpr {
    const exprList = group.rules.map(GenericInstanceFilterToECSqlAstSerializer.serializeRuleOrRuleGroup);
    const first = exprList.shift()!;
    if (exprList.length === 0) {
      return first;
    }
    const op = group.operator === PropertyFilterRuleGroupOperator.And ? "AND" : "OR";
    return exprList.reduce((lhs, rhs) => {
      return new BinaryBooleanExpr(op, lhs, rhs);
    }, first);
  }

  private static serializeRule(rule: GenericInstanceFilterRule): BooleanExpr {
    const lhs = new PropertyNameExpr(`[${rule.sourceAlias}].[${rule.propertyName}]${rule.propertyTypeName === "navigation" ? ".[Id]" : ""}`);
    if (rule.operator === "is-false") {
      return new BinaryBooleanExpr("=", lhs, new LiteralExpr(LiteralValueType.Raw, "FALSE"));
    } else if (rule.operator === "is-true") {
      return new BinaryBooleanExpr("=", lhs, new LiteralExpr(LiteralValueType.Raw, "TRUE"));
    } else if (rule.operator === "is-null") {
      return new IsNullExpr(lhs);
    } else if (rule.operator === "is-not-null") {
      return new IsNullExpr(lhs, "NOT");
    } else if (rule.value) {
      const rhs = GenericInstanceFilterToECSqlAstSerializer.serializeRuleValue(rule.value.rawValue);
      if (rule.operator === "greater") {
        return new BinaryBooleanExpr(">", lhs, rhs);
      } else if (rule.operator === "greater-or-equal") {
        return new BinaryBooleanExpr(">=", lhs, rhs);
      } else if (rule.operator === "less") {
        return new BinaryBooleanExpr("<", lhs, rhs);
      } else if (rule.operator === "less-or-equal") {
        return new BinaryBooleanExpr("<=", lhs, rhs);
      } else if (rule.operator === "is-equal") {
        return new BinaryBooleanExpr("=", lhs, rhs);
      } else if (rule.operator === "is-not-equal") {
        return new BinaryBooleanExpr("<>", lhs, rhs);
      } else if (rule.operator === "like") {
        return new LikeExpr(lhs, rhs);
      }
    }
    throw new Error("not supported");
  }

  private static serializeRuleOrRuleGroup(this: void, rules: GenericInstanceFilterRule | GenericInstanceFilterRuleGroup) {
    if (GenericInstanceFilter.isFilterRuleGroup(rules)) {
      return GenericInstanceFilterToECSqlAstSerializer.serializeRuleGroup(rules);
    }
    return GenericInstanceFilterToECSqlAstSerializer.serializeRule(rules);
  }

  private static serializeFilter(rules: GenericInstanceFilterRule | GenericInstanceFilterRuleGroup): WhereClauseExp {
    return new WhereClauseExp(GenericInstanceFilterToECSqlAstSerializer.serializeRuleOrRuleGroup(rules));
  }

  public static serialize(filter: GenericInstanceFilter, rootClassName: string) {
    const fromClause = GenericInstanceFilterToECSqlAstSerializer.serializeRelationships(
      filter.relatedInstances,
      new ClassNameExpr(
        GenericInstanceFilterToECSqlAstSerializer.getSchemaNameOrAlias(rootClassName),
        GenericInstanceFilterToECSqlAstSerializer.getClassName(rootClassName), undefined, "this"),
    );

    const whereClause = GenericInstanceFilterToECSqlAstSerializer.serializeFilter(filter.rules);
    return new SelectStatementExpr(
      new SelectExpr(
        new SelectionClauseExpr([
          new DerivedPropertyExpr(
            new PropertyNameExpr(`this.ECInstanceId`)),
        ]),
        undefined,
        fromClause,
        whereClause));
  }
}
