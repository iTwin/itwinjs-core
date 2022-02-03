/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Validation
 */

import type { ISchemaPartVisitor, Schema } from "@itwin/ecschema-metadata";
import type { IRuleSet } from "./Rules";
import { SchemaValidationVisitor } from "./SchemaValidationVisitor";
import type { IDiagnosticReporter} from "./DiagnosticReporter";
import { SuppressionDiagnosticReporter } from "./DiagnosticReporter";
import type { AnyDiagnostic } from "./Diagnostic";
import { SchemaWalker } from "./SchemaWalker";
import { ECRuleSet } from "./ECRules";

class CollectionReporter extends SuppressionDiagnosticReporter {
  private _diagnostics: AnyDiagnostic[] = [];

  /** Gets the collection of diagnostic message. */
  public get diagnostics(): AnyDiagnostic[] {
    return this._diagnostics;
  }

  /**
   * Handles the given [[IDiagnostic]] based on the implementation requirements for a
   * given reporter.
   * @param diagnostic The diagnostic to report.
   */
  protected reportInternal(diagnostic: AnyDiagnostic) {
    this._diagnostics.push(diagnostic);
  }
}

/**
 * Applies EC Rules, see [[ECRuleSet]], to a given Schema and reports any violations.
 * @beta
 */
export class SchemaValidater {
  /**
   * Validates a schema against the [[ECRuleSet]].
   * @param schema The schema to validate.
   * @param validaterRuleSet Optional IRuleSet to be applied to the schema in addition to the default EC rules.
   */
  public static async validateSchema(schema: Schema, validaterRuleSet?: IRuleSet): Promise<AnyDiagnostic[]> {
    const collectionReporter = new CollectionReporter();
    const reporters: IDiagnosticReporter[] = [collectionReporter];

    const ruleSets = [ECRuleSet];
    if (validaterRuleSet)
      ruleSets.push(validaterRuleSet);

    const visitor = this.createNewVisitor(ruleSets, reporters);
    const reader = new SchemaWalker(visitor);
    await reader.traverseSchema(schema);

    return collectionReporter.diagnostics;
  }

  private static createNewVisitor(ruleSets: IRuleSet[], reporters: IDiagnosticReporter[]): ISchemaPartVisitor {
    const visitor = new SchemaValidationVisitor();
    ruleSets.forEach((set) => visitor.registerRuleSet(set));
    reporters.forEach((reporter) => visitor.registerReporter(reporter));
    return visitor;
  }
}
