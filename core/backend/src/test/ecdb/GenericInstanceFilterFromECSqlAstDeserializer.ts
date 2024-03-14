
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { GenericInstanceFilter, GenericInstanceFilterRelatedInstanceDescription, GenericInstanceFilterRelationshipStep, GenericInstanceFilterRule, GenericInstanceFilterRuleGroup, GenericInstanceFilterRuleValue } from "@itwin/core-common";
import { BinaryBooleanExpr, BinaryBooleanOp, BooleanExpr, ClassNameExpr, FromClauseExpr, IsNullExpr, LikeExpr, LiteralExpr, LiteralValueType, PropertyNameExpr, QualifiedJoinExpr, SelectStatementExpr, WhereClauseExp } from "@itwin/ecsql-common";

export class GenericInstanceFilterFromECSqlAstDeserializer {
  private static collectQualifiedJoin(join: QualifiedJoinExpr): QualifiedJoinExpr[] {
    if (join.from.isInstanceOf(QualifiedJoinExpr)) {
      return [join, ...GenericInstanceFilterFromECSqlAstDeserializer.collectQualifiedJoin(join.from.asInstanceOf(QualifiedJoinExpr)!)];
    }
    return [join];
  }
  private static parseRelationshipJoin(sourceJoin: QualifiedJoinExpr) {
    if (!sourceJoin.to.isInstanceOf(ClassNameExpr)) {
      throw new Error("expect class name");
    }

    const toClass = sourceJoin.to.asInstanceOf(ClassNameExpr)!;
    if (sourceJoin.joinType !== "INNER JOIN") {
      throw new Error("expected inner join");
    }
    if (!(sourceJoin.spec instanceof BooleanExpr)) {
      throw new Error("expect join spec to be boolean expr");
    }
    const spec = sourceJoin.spec;
    if (!spec.isInstanceOf(BinaryBooleanExpr)) {
      throw new Error("expect boolean expr");
    }
    const specBin = spec.asInstanceOf(BinaryBooleanExpr)!;
    if (!specBin.lhsExpr.isInstanceOf(PropertyNameExpr)) {
      throw new Error("expect property name expr");
    }
    if (!specBin.rhsExpr.isInstanceOf(PropertyNameExpr)) {
      throw new Error("expect property name expr");
    }
    if (specBin.op !== "=") {
      throw new Error("expect =");
    }

    const lhs = specBin.lhsExpr.asInstanceOf(PropertyNameExpr)!;
    const rhs = specBin.rhsExpr.asInstanceOf(PropertyNameExpr)!;
    const lhsProp = GenericInstanceFilterFromECSqlAstDeserializer.parseRelationshipJoinSpecAlias(lhs);
    const rhsProp = GenericInstanceFilterFromECSqlAstDeserializer.parseRelationshipJoinSpecAlias(rhs);
    return { toClass, lhsProp, rhsProp };
  }

  private static deserializeRelationships(expr: FromClauseExpr): { rootClass: string, related: GenericInstanceFilterRelatedInstanceDescription[] } {
    if (expr.classRefs.length !== 1) {
      throw new Error("expect only one class ref in from clause");
    }

    const next = expr.classRefs[0];
    if (next.isInstanceOf(ClassNameExpr)) {
      const classNameExp = next.asInstanceOf(ClassNameExpr)!;
      return { rootClass: `${classNameExp.schemaNameOrAlias}:${classNameExp.className}`, related: [] };
    }

    if (next.isInstanceOf(QualifiedJoinExpr)) {
      const joins = GenericInstanceFilterFromECSqlAstDeserializer.collectQualifiedJoin(next.asInstanceOf(QualifiedJoinExpr)!).reverse();
      const relatedInstances: GenericInstanceFilterRelatedInstanceDescription[] = [];
      let j = 0;

      if (!joins[0].from.isInstanceOf(ClassNameExpr)) {
        throw new Error("expect class name expr");
      }
      let prevClassRef = joins[0].from.asInstanceOf(ClassNameExpr)!;

      for (let i = 0; i < joins.length; i += 2) {
        const sourceRel = GenericInstanceFilterFromECSqlAstDeserializer.parseRelationshipJoin(joins[i]);
        const targetRel = GenericInstanceFilterFromECSqlAstDeserializer.parseRelationshipJoin(joins[i + 1]);

        const step: GenericInstanceFilterRelationshipStep = {
          sourceClassName: `${prevClassRef.schemaNameOrAlias}:${prevClassRef.className}`,
          targetClassName: `${targetRel.toClass.schemaNameOrAlias}:${targetRel.toClass.className}`,
          relationshipClassName: `${sourceRel.toClass.schemaNameOrAlias}:${sourceRel.toClass.className}`,
          isForwardRelationship: sourceRel.lhsProp.propertyName === "SourceECInstanceId",
        };
        prevClassRef = targetRel.toClass;
        if (sourceRel.toClass.alias?.startsWith("rel_")) {
          j = Number(sourceRel.toClass.alias.split("_")[1]);
        }
        if (relatedInstances.length < j + 1) {
          relatedInstances.push({ alias: "", path: [] });
        }
        relatedInstances[j].path.push(step);
        if (targetRel.toClass.alias)
          relatedInstances[j].alias = targetRel.toClass.alias;

      }
      return { rootClass: relatedInstances[0].path[0].sourceClassName, related: relatedInstances };
    }
    throw new Error("unsupported type of ClassRefExp");
  }

  private static parseRelationshipJoinSpecAlias(propertyName: PropertyNameExpr) {
    const path = propertyName.propertyPath.split(".");
    if (path.length !== 2) {
      throw new Error("must have two component");
    }
    return { alias: path[0], propertyName: path[1] };
  }

  private static deserializeRuleValue(expr: LiteralExpr): GenericInstanceFilterRuleValue.Values {
    if (expr.valueType === LiteralValueType.Raw && typeof expr.rawValue === "string") {
      if (expr.rawValue.startsWith("0x")) {
        return { id: expr.rawValue, className: "<unknown>" };
      }

      const numeric = Number.parseFloat(expr.rawValue);
      if (!Number.isNaN(numeric)) {
        return numeric;
      }

      throw new Error("unsupported value type");
    }

    if (expr.valueType === LiteralValueType.String) {
      return expr.rawValue;
    }

    throw new Error("unsupported value type");
  }
  private static collectLhsGroupExprs(expr: BinaryBooleanExpr): BinaryBooleanExpr[] {
    if (expr.op !== "OR" && expr.op !== "AND") {
      throw new Error("Only OR/AND boolean operator are supported");
    }
    const lhs = expr.lhsExpr.asInstanceOf(BinaryBooleanExpr);
    if (lhs && lhs.op === expr.op) {
      return [expr, ... this.collectLhsGroupExprs(lhs)];
    }
    return [expr];
  }
  private static isRule(expr: BooleanExpr) {
    if (!expr.asInstanceOf(BinaryBooleanExpr)) {
      return false;
    }

    const binExpr = expr.asInstanceOf(BinaryBooleanExpr)!;
    return binExpr.lhsExpr.isInstanceOf(PropertyNameExpr) && binExpr.rhsExpr.isInstanceOf(LiteralExpr);
  }

  private static isRuleGroup(expr: BooleanExpr) {
    if (!expr.asInstanceOf(BinaryBooleanExpr)) {
      return false;
    }

    const binExpr = expr.asInstanceOf(BinaryBooleanExpr)!;
    return binExpr.op === "OR" || binExpr.op === "AND";
  }

  private static deserializeRuleGroup(expr: BooleanExpr): GenericInstanceFilterRuleGroup {
    if (!GenericInstanceFilterFromECSqlAstDeserializer.isRuleGroup(expr)) {
      throw new Error("expected a rule group expression");
    }

    const rules: Array<GenericInstanceFilterRule | GenericInstanceFilterRuleGroup> = [];
    const groupExprs = this.collectLhsGroupExprs(expr.asInstanceOf(BinaryBooleanExpr)!).reverse();
    for (const groupExpr of groupExprs) {
      if (this.isRule(groupExpr.lhsExpr)) {
        rules.push(this.deserializeRule(groupExpr.lhsExpr));
      }
      if (this.isRuleGroup(groupExpr.rhsExpr)) {
        rules.push(this.deserializeRuleOrRuleGroup(groupExpr.rhsExpr.asInstanceOf(BinaryBooleanExpr)!));
      } else if (this.isRule(groupExpr.rhsExpr)) {
        rules.push(this.deserializeRule(groupExpr.rhsExpr));
      } else {
        throw new Error("unexpected rule case");
      }
    }
    const groupOp = groupExprs[0].op;
    return { operator: groupOp === "OR" ? "or" : "and", rules };
  }

  private static deserializeRule(expr: BooleanExpr): GenericInstanceFilterRule {
    if (!expr.isInstanceOf(BinaryBooleanExpr)) {
      throw new Error("expect binary expression");
    }

    const binExp = expr.asInstanceOf(BinaryBooleanExpr)!;
    if (!binExp.lhsExpr.isInstanceOf(PropertyNameExpr)) {
      throw new Error("expect only property name on lhs of rule expr");
    }

    const lhs = binExp.lhsExpr.asInstanceOf(PropertyNameExpr)!;
    const pathComp = lhs.propertyPath.replaceAll(/\[|\]/g, "").split(".");
    if (pathComp.length < 2) {
      throw new Error("property path must have alias and property name");
    }
    const sourceAlias = pathComp[0];
    const propertyName = pathComp[1];
    const isNav = typeof pathComp[2] === "string" ? pathComp[2].toLowerCase() === "id" : "";
    const propertyTypeName = isNav ? "navigation" : "";
    if (binExp.rhsExpr.isInstanceOf(LiteralExpr)) {
      const rhs = binExp.rhsExpr.asInstanceOf(LiteralExpr)!;
      if (rhs.valueType === LiteralValueType.Raw && rhs.rawValue.toUpperCase() === "TRUE") {
        return { propertyName, operator: "is-true", propertyTypeName: "boolean", sourceAlias };
      }

      if (rhs.valueType === LiteralValueType.Raw && rhs.rawValue.toUpperCase() === "FALSE") {
        return { propertyName, operator: "is-false", propertyTypeName: "boolean", sourceAlias };
      }

      const value = { rawValue: GenericInstanceFilterFromECSqlAstDeserializer.deserializeRuleValue(rhs), displayValue: "" };
      if (binExp.op === ">") {
        return { propertyName, operator: "greater", propertyTypeName, sourceAlias, value };
      } else if (binExp.op === ">=") {
        return { propertyName, operator: "greater-or-equal", propertyTypeName, sourceAlias, value };
      } else if (binExp.op === "<") {
        return { propertyName, operator: "less", propertyTypeName, sourceAlias, value };
      } else if (binExp.op === "<=") {
        return { propertyName, operator: "less-or-equal", propertyTypeName, sourceAlias, value };
      } else if (binExp.op === "<>" || binExp.op === "!=") {
        return { propertyName, operator: "is-not-equal", propertyTypeName, sourceAlias, value };
      } else if (binExp.op === "=") {
        return { propertyName, operator: "is-equal", propertyTypeName, sourceAlias, value };
      }
      throw new Error("unsupported operator");
    } else if (binExp.rhsExpr.isInstanceOf(IsNullExpr)) {
      const rhs = binExp.rhsExpr.asInstanceOf(IsNullExpr)!;
      if (rhs.not) {
        return { propertyName, operator: "is-not-null", propertyTypeName, sourceAlias };
      }

      return { propertyName, operator: "is-null", propertyTypeName, sourceAlias };
    } else if (binExp.rhsExpr.isInstanceOf(LikeExpr)) {
      const rhs = binExp.rhsExpr.asInstanceOf(LikeExpr)!;
      if (!rhs.patternExpr.isInstanceOf(LikeExpr)) {
        throw new Error("like operator expect rhs a string literal");
      }

      const value = { rawValue: GenericInstanceFilterFromECSqlAstDeserializer.deserializeRuleValue(rhs.patternExpr.asInstanceOf(LiteralExpr)!), displayValue: "" };
      return { propertyName, operator: "like", propertyTypeName, sourceAlias, value };
    }
    throw new Error("not supported");
  }

  private static deserializeRuleOrRuleGroup(expr: BooleanExpr): GenericInstanceFilterRule | GenericInstanceFilterRuleGroup {
    if (GenericInstanceFilterFromECSqlAstDeserializer.isRuleGroup(expr)) {
      return GenericInstanceFilterFromECSqlAstDeserializer.deserializeRuleGroup(expr);
    }
    return GenericInstanceFilterFromECSqlAstDeserializer.deserializeRule(expr);
  }

  private static deserializeFilter(whereExp: WhereClauseExp): GenericInstanceFilterRule | GenericInstanceFilterRuleGroup {
    return GenericInstanceFilterFromECSqlAstDeserializer.deserializeRuleOrRuleGroup(whereExp.filterExpr);
  }

  public static deserialize(stmt: SelectStatementExpr): { rootClass: string, filter: GenericInstanceFilter } {
    if (stmt.nextSelect) {
      throw new Error("expect single statement");
    }

    if (!stmt.singleSelect.from) {
      throw new Error("expect FROM clause");
    }

    if (!stmt.singleSelect.where) {
      throw new Error("expect WHERE clause");
    }

    const relationships = GenericInstanceFilterFromECSqlAstDeserializer.deserializeRelationships(stmt.singleSelect.from);
    const rules = GenericInstanceFilterFromECSqlAstDeserializer.deserializeFilter(stmt.singleSelect.where);
    return {
      rootClass: relationships.rootClass,
      filter: { rules, relatedInstances: relationships.related, propertyClassNames: [] },
    };
  }
}
