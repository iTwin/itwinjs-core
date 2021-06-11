---
publish: false
---
# NextVersion

## [@bentley/ecschema-metadata](https://www.itwinjs.org/reference/ecschema-metadata/) changes

To reduce the size and limit the scope of the APIs available in the ecschema-metadata package, all APIs associated with EC Schema editing and validation have been moved to the [@bentley/ecschema-editing](https://www.itwinjs.org/reference/ecschema-editing/) package. This includes all source code under the [Validation](https://www.itwinjs.org/reference/ecschema-metadata/) and [Editing](https://www.itwinjs.org/reference/ecschema-metadata/editing/) folders. All corresponding @beta types defined in the ecschema-metadata package have been deprecated.  All @alpha types have been removed from the ecschema-metadata package. The source code move is the first step of a larger proposal for Schema editing and validation enhancements for connectors and editing applications. You may read and provide feedback on this initial proposal via this [github discussion](https://github.com/imodeljs/imodeljs/discussions/1525).

### Deprecated @beta types (moved to ecschema-editing)

- IDiagnostic, BaseDiagnostic (including all sub-classes), DiagnosticType, DiagnosticCategory, DiagnosticCodes, Diagnostics
- IDiagnosticReporter, SuppressionDiagnosticReporter, FormatDiagnosticReporter, LoggingDiagnosticReporter
- IRuleSet, ECRuleSet
- ISuppressionRule, BaseSuppressionRule, IRuleSuppressionMap, BaseRuleSuppressionMap, IRuleSuppressionSet
- SchemaCompareCodes, SchemaCompareDiagnostics
- SchemaValidater, SchemaValidationVisitor

### Removed @alpha types (moved to ecschema-editing)

- SchemaEditResults, SchemaItemEditResults, PropertyEditResults,
SchemaContextEditor
- Editors namespace, which includes all editor classes (ie. ECClasses, Entities, Mixins, etc.)
- ISchemaChange, ISchemaChanges, ChangeType
- BaseSchemaChange, BaseSchemaChanges (including all sub-classes)
- ISchemaComparer, SchemaComparer, SchemaCompareDirection, ISchemaCompareReporter
