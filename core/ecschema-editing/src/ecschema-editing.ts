/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

export * from "./Validation/Diagnostic";
export * from "./Validation/DiagnosticReporter";
/* eslint-disable-next-line deprecation/deprecation */
export { DiagnosticCodes, Diagnostics, ECRuleSet } from "./Validation/ECRules";
export * from "./Validation/LoggingDiagnosticReporter";
export * from "./Validation/Rules";
export * from "./Validation/SchemaValidationVisitor";
export * from "./Validation/SchemaWalker";
export * from "./Validation/SchemaCompareDiagnostics";
export * from "./Validation/SchemaChanges";
export * from "./Validation/SchemaComparer";
export * from "./Validation/SchemaCompareReporter";
export * from "./Editing/Editor";
export { ISuppressionRule, IRuleSuppressionSet, IRuleSuppressionMap } from "./Validation/RuleSuppressionSet";
export { SchemaValidater } from "./Validation/SchemaValidater";

/** @docs-package-description
 * The ecschema-editing package contains classes for validating, and editing ECSchemas that can be used in both [frontend]($docs/learning/frontend/index.md) and [backend]($docs/learning/backend/index.md).
 */
/**
 * @docs-group-description Editing
 * Set of classes used to perform editing of ECSchemas.
 */
/**
 * @docs-group-description Diagnostic
 * Set of classes to categorize and manage ECSchema validation results.
 */
/**
 * @docs-group-description Validation
 * Set of classes used to perform validation on ECSchemas.
 */
/**
 * @docs-group-description Comparison
 * Set of classes to enable comparison of ECSchemas.
 */
