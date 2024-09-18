import { beforeEach, describe, expect, it } from "vitest";
import { SchemaContextEditor } from "../../Editing/Editor";
import { RelationshipClass, RelationshipConstraint, RelationshipEnd, Schema, SchemaContext, SchemaItemKey, SchemaItemType, SchemaKey } from "@itwin/ecschema-metadata";
import { ClassId, ECEditingStatus, PropertyId, RelationshipConstraintId, SchemaEditingError, SchemaId, SchemaItemId } from "../../Editing/Exception";
import { AnyDiagnostic, Diagnostics } from "../../ecschema-editing";

function getRuleViolationMessage(ruleViolations: AnyDiagnostic[]) {
  let violations = "";
  for (const diagnostic of ruleViolations){
    violations += `${diagnostic.code}: ${diagnostic.messageText}\r\n`;
  }
  return violations;
}

describe("SchemaEditingError tests", () => {
  let testEditor: SchemaContextEditor;
  let testSchema: Schema | undefined;
  let testKey: SchemaKey;
  let context: SchemaContext;

  beforeEach(async () => {
    context = new SchemaContext();
    testEditor = new SchemaContextEditor(context);
    testKey = await testEditor.createSchema("TestSchema", "test", 1, 0, 0);
    testSchema = await testEditor.getSchema(testKey);
    if (!testSchema)
      throw new Error("schema could not be found");
  });

  it("Should create proper debug string with inner exception of type SchemaEditingError", async () => {
    const diagnostics = [
      new Diagnostics.SchemaRefAliasMustBeUnique(testSchema!, [testSchema!.name, "b", "SchemaB", "SchemaC"]),
      new Diagnostics.ReferenceCyclesNotAllowed(testSchema!, [testSchema!.name, `SchemaC --> SchemaA, SchemaA --> SchemaC`]),
    ];
    const innerError = new SchemaEditingError(ECEditingStatus.RuleViolation, new SchemaId(testKey), undefined, diagnostics);
    const error = new SchemaEditingError(ECEditingStatus.AddSchemaReference, new SchemaId(testKey), innerError);
    expect(error.toDebugString()).toEqual(`ECEditingStatus.AddSchemaReference: While performing task '${ECEditingStatus[error.errorNumber]}' an error occurred editing Schema ${testKey.name}. Inner error: ECEditingStatus.RuleViolation: Rule violations occurred from Schema TestSchema: ${getRuleViolationMessage(diagnostics)}`);
  });

  it("Should create proper debug string with inner exception of type Error", async () => {
    const innerError = new Error("Could not create EntityClass testEntityClass for some unknown reason.");
    const error = new SchemaEditingError(ECEditingStatus.CreateSchemaItemFailed, new ClassId(SchemaItemType.EntityClass, "TestEntity", testKey), innerError);
    expect(error.toDebugString()).toEqual(`ECEditingStatus.CreateSchemaItemFailed: While performing task '${ECEditingStatus[error.errorNumber]}' an error occurred editing Class TestSchema.TestEntity. Inner error: Could not create EntityClass testEntityClass for some unknown reason.`);
  });

  it("Should create correct error message for Schema task error", async () => {
    const identifier = new SchemaId(testKey);
    const error = new SchemaEditingError(ECEditingStatus.CreateElement, identifier, new Error("inner error"));
    expect(error.message).toEqual(`While performing task '${ECEditingStatus[error.errorNumber]}' an error occurred editing Schema ${identifier.name}.`);
  });

  it("Should create correct error message for SchemaItem task error", async () => {
    const identifier = new SchemaItemId(SchemaItemType.Unit, "TestUnit", testKey);
    const error = new SchemaEditingError(ECEditingStatus.CreateSchemaItemFailed, identifier, new Error("inner error"));
    expect(error.message).toEqual(`While performing task '${ECEditingStatus[error.errorNumber]}' an error occurred editing SchemaItem ${identifier.name}.`);
  });

  it("Should create correct error message for Class task error", async () => {
    const identifier = new ClassId(SchemaItemType.EntityClass, "TestEntity", testKey);
    const error = new SchemaEditingError(ECEditingStatus.CreateElement, identifier, new Error("inner error"));
    expect(error.message).toEqual(`While performing task '${ECEditingStatus[error.errorNumber]}' an error occurred editing Class ${identifier.name}.`);
  });

  it("Should create correct error message for Property task error", async () => {
    const itemKey = new SchemaItemKey("TestEntity", testKey);
    const identifier = new PropertyId(SchemaItemType.EntityClass, itemKey, "TestProperty");
    const error = new SchemaEditingError(ECEditingStatus.SetPropertyName, identifier, new Error("inner error"));
    expect(error.message).toEqual(`While performing task '${ECEditingStatus[error.errorNumber]}' an error occurred editing Property ${identifier.fullName}.`);
  });

  it("Should create correct error message for RelationshipConstraint task error", async () => {
    const relClass = new RelationshipClass(testSchema!, "TestRelationship");
    const testConstraint = new RelationshipConstraint(relClass, RelationshipEnd.Source);
    const identifier = new RelationshipConstraintId(testConstraint);
    const error = new SchemaEditingError(ECEditingStatus.AddCustomAttributeToConstraint, identifier, new Error("inner error"));
    expect(error.message).toEqual(`While performing task '${ECEditingStatus[error.errorNumber]}' an error occurred editing RelationshipConstraint ${identifier.name}.`);
  });

});
