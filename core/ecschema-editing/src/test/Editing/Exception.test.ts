import { expect } from "chai";
import { SchemaContextEditor } from "../../Editing/Editor";
import { Schema, SchemaContext, SchemaItemType, SchemaKey } from "@itwin/ecschema-metadata";
import { ECEditingStatus, SchemaEditingError, SchemaId, SchemaItemId } from "../../Editing/Exception";
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
    testKey = await testEditor.createSchema("testSchema", "test", 1, 0, 0);
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
    expect(error.toDebugString()).to.equal(`ECEditingStatus.AddSchemaReference: Inner error: ECEditingStatus.RuleViolation: Rule violations occurred from Schema testSchema: ${getRuleViolationMessage(diagnostics)}`);
  });

  it("Should create proper debug string with inner exception of type Error", async () => {
    const innerError = new Error("Could not create EntityClass testEntityClass for some unknown reason.");
    const error = new SchemaEditingError(ECEditingStatus.CreateSchemaItemFailed, new SchemaItemId(SchemaItemType.EntityClass, "TestEntity", testKey), innerError);
    expect(error.toDebugString()).to.equal(`ECEditingStatus.CreateSchemaItemFailed: Inner error: Could not create EntityClass testEntityClass for some unknown reason.`);
  });
});
