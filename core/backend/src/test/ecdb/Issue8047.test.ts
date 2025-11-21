import { assert } from "chai";
import * as path from "path";
import * as fs from "fs";
import { ECDb } from "../../ECDb";
import { IModelHost } from "../../IModelHost";
import { IModelJsFs } from "../../IModelJsFs";
import { SchemaContext, SchemaJsonLocater, SchemaKey, SchemaMatchType, EntityClass } from "@itwin/ecschema-metadata";

describe("Issue #8047: Derived Classes in Reference Schemas", () => {
  const outputDir = path.join(__dirname, "output_8047");
  const ecdbPath = path.join(outputDir, "test_8047.ecdb");

  before(async () => {
    await IModelHost.startup();
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }
    if (fs.existsSync(ecdbPath)) {
      IModelJsFs.unlinkSync(ecdbPath);
    }
  });

  after(async () => {
    await IModelHost.shutdown();
    if (fs.existsSync(outputDir)) {
      IModelJsFs.removeSync(outputDir);
    }
  });

  it("should find derived classes in referencing schemas ONLY if referencing schema is loaded", async () => {
    const ecdb = new ECDb();
    ecdb.createDb(ecdbPath);

    // 1. Create Schema 1 (The Parent)
    const schemaXml1 = `<?xml version="1.0" encoding="UTF-8"?>
      <ECSchema schemaName="TestSchema1" alias="Test1" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECEntityClass typeName="ParentClass" />
      </ECSchema>`;
    const schemaPath1 = path.join(outputDir, "TestSchema1.01.00.00.xml");
    fs.writeFileSync(schemaPath1, schemaXml1);
    ecdb.importSchema(schemaPath1);

    // 2. Create Schema 2 (The Child) - References Schema 1
    const schemaXml2 = `<?xml version="1.0" encoding="UTF-8"?>
      <ECSchema schemaName="TestSchema2" alias="Test2" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECSchemaReference name="TestSchema1" version="01.00.00" alias="t1" />
        <ECEntityClass typeName="ChildClass">
          <BaseClass>t1:ParentClass</BaseClass>
        </ECEntityClass>
      </ECSchema>`;
    const schemaPath2 = path.join(outputDir, "TestSchema2.01.00.00.xml");
    fs.writeFileSync(schemaPath2, schemaXml2);
    ecdb.importSchema(schemaPath2);
    ecdb.saveChanges();

    // 3. Setting up the Context
    const context = new SchemaContext();

    // fix: Using ecdb.getSchemaProps() to return the JSON object, NOT the XML string.
    // it now satisfies the 'SchemaPropsGetter' type signature.
    const locater = new SchemaJsonLocater((name: string) => ecdb.getSchemaProps(name));
    context.addLocater(locater);

    // 4. Get the Parent Class
    const testSchema1 = await context.getSchema(new SchemaKey("TestSchema1"), SchemaMatchType.Latest);
    if (!testSchema1) throw new Error("Failed to load TestSchema1");

    const parentClass = await testSchema1.getItem("ParentClass", EntityClass);
    if (!parentClass) throw new Error("Failed to load ParentClass");

    // Ttest case A: Verify it returns 0 when Schema 2 is unloaded
    let derivedClasses = await parentClass.getDerivedClasses();

    // fix: Handle strict undefined check
    const countUnloaded = derivedClasses ? derivedClasses.length : 0;
    assert.equal(countUnloaded, 0, "Should verify that 0 classes are found when referencing schema is unloaded");

    // Test case B: Verify the workaround (Load Schema 2)
    await context.getSchema(new SchemaKey("TestSchema2"), SchemaMatchType.Latest);

    derivedClasses = await parentClass.getDerivedClasses();

    // fix: Strict assertion to ensure derivedClasses is defined
    assert.isDefined(derivedClasses);
    assert.equal(derivedClasses!.length, 1, "Should find 1 derived class after referencing schema is loaded");
    assert.equal(derivedClasses![0].name, "ChildClass");

    ecdb.closeDb();
  });
});