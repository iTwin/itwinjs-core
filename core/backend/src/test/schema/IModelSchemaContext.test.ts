/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import * as fs from "fs";
import { Code } from "@itwin/core-common";
import {
  DefinitionElement,
  ECDb,
  Element,
  IModelHost,
  IModelJsFs,
  InformationContentElement,
  RepositoryLink,
  SnapshotDb, SpatialViewDefinition, UrlLink, ViewDefinition3d,
} from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { EntityClass, SchemaContext, SchemaJsonLocater, SchemaKey, SchemaMatchType } from "@itwin/ecschema-metadata";

describe("IModel Schema Context", () => {
  let imodel: SnapshotDb;

  before(() => {
    const seedFileName = IModelTestUtils.resolveAssetFile("test.bim");
    const testFileName = IModelTestUtils.prepareOutputFile("IModelSchemaContext", "IModelSchemaContext.bim");
    imodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
    assert.exists(imodel);
  });

  after(() => {
    imodel?.close();
  });

  it("should verify the Entity metadata of known element subclasses", async () => {
    const code1 = new Code({ spec: "0x10", scope: "0x11", value: "RF1.dgn" });
    const el = imodel.elements.getElement(code1);
    assert.exists(el);
    if (el) {
      const ecClass = await el.getMetaData();
      assert.exists(ecClass);
      assert.equal(ecClass.schema.name, el.schemaName);
      assert.equal(ecClass.name, el.className);

      // I happen to know that this is a BisCore:RepositoryLink
      assert.equal(ecClass.fullName, RepositoryLink.schemaItemKey.fullName);
      //  Check the metadata on the class itself
      const baseClass = await ecClass.baseClass;
      assert.exists(ecClass.baseClass);
      if (undefined === baseClass)
        return;

      assert.equal(baseClass.fullName, UrlLink.schemaItemKey.fullName);
      assert.exists(ecClass.customAttributes);
      assert.isTrue(ecClass.customAttributes?.has("BisCore.ClassHasHandler"));
      //  Check the metadata on the one property that RepositoryLink defines, RepositoryGuid
      const property = await ecClass.getProperty("repositoryGuid");
      assert.exists(property);
      if (undefined === property)
        return;

      if(!property.isPrimitive())
        assert.fail("Property is not primitive");

      assert.equal(property.extendedTypeName, "BeGuid");
      assert.isTrue(property.customAttributes?.has("CoreCustomAttributes.HiddenProperty"));
    }
    const el2 = imodel.elements.getElement("0x34");
    assert.exists(el2);
    if (el2) {
      const metaData = await el2.getMetaData();
      assert.exists(metaData);
      if (undefined === metaData)
        return;
      assert.equal(metaData.fullName, el2.schemaItemKey.fullName);
      // I happen to know that this is a BisCore.SpatialViewDefinition
      assert.equal(metaData.fullName, SpatialViewDefinition.schemaItemKey.fullName);

      const baseClass = await metaData.baseClass;
      assert.exists(metaData.baseClass);
      if (undefined === baseClass)
        return;

      assert.equal(baseClass.fullName, ViewDefinition3d.schemaItemKey.fullName);
      const prop = metaData.getPropertySync("modelSelector");
      assert.isDefined(prop);
      if(!prop?.isNavigation())
        assert.fail("Property is not navigation property");

      assert.equal((await prop.relationshipClass).fullName, "BisCore.SpatialViewDefinitionUsesModelSelector");
    }
  });

  it("should verify Entity metadata with both base class and mixin properties", async () => {
    const schemaPathname = path.join(KnownTestLocations.assetsDir, "TestDomain.ecschema.xml");
    await imodel.importSchemas([schemaPathname]); // will throw an exception if import fails

    const testDomain = await imodel.schemaContext.getSchema(new SchemaKey("TestDomain", 1,0,0));
    const testDomainClass = await testDomain!.getEntityClass("TestDomainClass");
    const baseClassFullNames = Array.from(testDomainClass!.getAllBaseClassesSync() ?? []).map(baseClass => baseClass.fullName);
    assert.equal(baseClassFullNames.length, 4);
    assert.equal(baseClassFullNames[0], DefinitionElement.schemaItemKey.fullName);
    assert.equal(baseClassFullNames[1], InformationContentElement.schemaItemKey.fullName);
    assert.equal(baseClassFullNames[2], Element.schemaItemKey.fullName);
    assert.equal(baseClassFullNames[3], "TestDomain.IMixin");

    // Verify that the forEach method which is called when constructing an entity
    // is picking up all expected properties.
    const properties = Array.from(await testDomainClass!.getProperties());
    const testData = properties.map(property => property.name);
    const expectedString = testData.find((testString: string) => {
      return testString === "TestMixinProperty";
    });

    assert.isDefined(expectedString);
  });
});

// --- Reproduction Test for Issue #8047 ---
describe("Issue #8047: Derived Classes in Reference Schemas", () => {
  const outputDir = path.join(__dirname, "output_8047");
  const ecdbPath = path.join(outputDir, "test_8047.ecdb");

  before(async () => {
    // Ensure IModelHost is startup (idempotent check)
    if (!IModelHost.isValid) {
        await IModelHost.startup();
    }
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }
    if (fs.existsSync(ecdbPath)) {
      IModelJsFs.unlinkSync(ecdbPath);
    }
  });

  after(async () => {
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

    // 3. Setup the Context
    const context = new SchemaContext();
    const locater = new SchemaJsonLocater((name: string) => ecdb.getSchemaProps(name));
    context.addLocater(locater);

    // 4. Get the Parent Class
    const testSchema1 = await context.getSchema(new SchemaKey("TestSchema1"), SchemaMatchType.Latest);
    if (!testSchema1) throw new Error("Failed to load TestSchema1");
    const parentClass = await testSchema1.getItem("ParentClass", EntityClass);
    if (!parentClass) throw new Error("Failed to load ParentClass");

    // TEST CASE A: Verify it returns 0 when Schema 2 is unloaded (Reproducing the "Bug")
    let derivedClasses = await parentClass.getDerivedClasses();
    const countUnloaded = derivedClasses ? derivedClasses.length : 0;
    assert.equal(countUnloaded, 0, "Should verify that 0 classes are found when referencing schema is unloaded");

    // TEST CASE B: Verify the workaround (Load Schema 2)
    await context.getSchema(new SchemaKey("TestSchema2"), SchemaMatchType.Latest);

    derivedClasses = await parentClass.getDerivedClasses();

    // This confirms the system works as intended IF you load the schema
    assert.isDefined(derivedClasses);
    assert.equal(derivedClasses!.length, 1, "Should find 1 derived class after referencing schema is loaded");
    assert.equal(derivedClasses![0].name, "ChildClass");

    ecdb.closeDb();
  });
});
