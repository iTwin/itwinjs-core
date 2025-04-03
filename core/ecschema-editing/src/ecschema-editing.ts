/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

export * from "./Differencing/Errors.js";
export * from "./Differencing/SchemaConflicts.js";
export * from "./Differencing/SchemaDifference.js";
export * from "./Differencing/Utils.js";
export * from "./Editing/Editor.js";
export * from "./Editing/Exception.js";
export * from "./Merging/Edits/SchemaEdits.js";
export { SchemaMerger } from "./Merging/SchemaMerger.js";
export * from "./Validation/Diagnostic.js";
export * from "./Validation/DiagnosticReporter.js";
export { DiagnosticCodes, Diagnostics, ECRuleSet } from "./Validation/ECRules.js";
export * from "./Validation/LoggingDiagnosticReporter.js";
export * from "./Validation/Rules.js";
export { IRuleSuppressionMap, IRuleSuppressionSet, ISuppressionRule } from "./Validation/RuleSuppressionSet.js";
export * from "./Validation/SchemaChanges.js";
export * from "./Validation/SchemaCompareDiagnostics.js";
export * from "./Validation/SchemaComparer.js";
export * from "./Validation/SchemaCompareReporter.js";
export { SchemaValidater } from "./Validation/SchemaValidater.js";
export * from "./Validation/SchemaValidationVisitor.js";
export * from "./Validation/SchemaWalker.js";

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
/**
 * @docs-group-description Merging
 * Set of classes used to merge schemas.
 */
/**
 * @docs-group-description Differencing
 * Set of classes used to perform differences between ECSchemas.
 */
