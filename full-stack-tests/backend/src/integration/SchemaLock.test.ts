/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { Suite } from "mocha";
import { _nativeDb, BriefcaseDb, DrawingCategory, IModelHost } from "@itwin/core-backend";
import { AzuriteTest } from "./AzuriteTest";
import { HubMock } from "@itwin/core-backend/lib/cjs/internal/HubMock";
import { HubWrappers, IModelTestUtils, KnownTestLocations } from "@itwin/core-backend/lib/cjs/test";
import { Guid, ITwinError } from "@itwin/core-bentley";
import { Code, GeometricElementProps, IModel, QueryBinder, SubCategoryAppearance } from "@itwin/core-common";
import { EntityClass, SchemaItemKey, SchemaKey } from "@itwin/ecschema-metadata";

describe.only("Schema lock tests", function (this: Suite) {
  this.timeout(0);

  before(async () => {
    IModelHost.authorizationClient = new AzuriteTest.AuthorizationClient();
    // AzuriteTest.userToken = AzuriteTest.service.userToken.readWrite;
  });

  after(async () => {
    IModelHost.authorizationClient = undefined;
  });

  it("importing schemas should lock", async () => {
    const iModelName = "SchemaLockMultiUserTest";
    const iTwinId = Guid.createValue();
    const user1AccessToken = "token 1";
    const user2AccessToken = "token 2";
    let user1Briefcase: BriefcaseDb | undefined;
    let user2Briefcase: BriefcaseDb | undefined;

    HubMock.startup("schemaLockTest", KnownTestLocations.outputDir);

    try {
      const iModelId = await HubMock.createNewIModel({ iTwinId, iModelName, description: "TestSubject", accessToken: user1AccessToken });
      assert.isNotEmpty(iModelId);
      user1Briefcase = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId, accessToken: user1AccessToken });

      const schema = `<?xml version="1.0" encoding="UTF-8"?>
      <ECSchema schemaName="TestDomain" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
          <ECEntityClass typeName="Test2dElement">
              <BaseClass>bis:GraphicalElement2d</BaseClass>
              <ECProperty propertyName="MyProperty" typeName="string"/>
          </ECEntityClass>
      </ECSchema>`;
      await user1Briefcase.importSchemaStrings([schema]);
      user1Briefcase.saveChanges();
      assert.isFalse(user1Briefcase.holdsSchemaLock);
      assert.isTrue(user1Briefcase.holdsSchemaTableLock);
      await user1Briefcase.pushChanges({ description: "import schema", accessToken: user1AccessToken });

      // Insert an element of the new class
      const modelCode = IModelTestUtils.getUniqueModelCode(user1Briefcase, "DrawingModel");
      await user1Briefcase.locks.acquireLocks({ shared: IModel.dictionaryId });
      const [, drawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(user1Briefcase, modelCode);
      // Create a drawing category
      const drawingCategoryId = DrawingCategory.insert(user1Briefcase, IModel.dictionaryId, "DrawingCategory", new SubCategoryAppearance());
      const firstElementProps: GeometricElementProps & { myProperty?: string } = {
        classFullName: "TestDomain:Test2dElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        myProperty: "MYPROP",
      };
      const firstElement = user1Briefcase.elements.createElement(firstElementProps);
      const firstElementId = user1Briefcase.elements.insertElement(firstElement.toJSON());
      assert.isTrue(firstElementId !== undefined, "First element should be inserted");
      user1Briefcase.saveChanges();

      await user1Briefcase.pushChanges({ description: "insert element of new class", accessToken: user1AccessToken });
      assert.isFalse(user1Briefcase.holdsSchemaLock);
      assert.isFalse(user1Briefcase.holdsSchemaTableLock);

      // Open briefcase as user 2.
      user2Briefcase = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId, accessToken: user2AccessToken });
      const updatedSchemaUser2 = `<?xml version="1.0" encoding="UTF-8"?>
      <ECSchema schemaName="TestDomain" alias="ts" version="01.00.01" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
          <ECEntityClass typeName="Test2dElement">
              <BaseClass>bis:GraphicalElement2d</BaseClass>
              <ECProperty propertyName="MyProperty" typeName="string"/>
              <ECProperty propertyName="MyPropertyForUser2" typeName="string"/>
          </ECEntityClass>
      </ECSchema>`;
      await user2Briefcase.importSchemaStrings([updatedSchemaUser2]);
      assert.isFalse(user2Briefcase.holdsSchemaLock);
      assert.isTrue(user2Briefcase.holdsSchemaTableLock);
      user2Briefcase.saveChanges();

      // Try what we can do now in briefcase 1 (user 1)
      const updatedSchemaUser1 = `<?xml version="1.0" encoding="UTF-8"?>
      <ECSchema schemaName="TestDomain" alias="ts" version="01.00.01" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
          <ECEntityClass typeName="Test2dElement">
              <BaseClass>bis:GraphicalElement2d</BaseClass>
              <ECProperty propertyName="MyProperty" typeName="string"/>
              <ECProperty propertyName="MyPropertyForUser1" typeName="string"/>
          </ECEntityClass>
      </ECSchema>`;
      await expect(user1Briefcase.importSchemaStrings([updatedSchemaUser1]))
        .to.be.rejectedWith("exclusive lock is already held");
      // Try to modify the existing element - should work since user2 only holds a schema lock.
      const element = user1Briefcase.elements.getElement(firstElementId);
      (element as any).myProperty = "UPDATED_VALUE";
      await user1Briefcase.locks.acquireLocks({ exclusive: firstElementId }); // should not throw, schema lock allows shared locks
      user1Briefcase.elements.updateElement(element.toJSON()); // should not throw
      user1Briefcase.saveChanges();
      await user1Briefcase.pushChanges({ description: "modify element after user2 schema change", accessToken: user1AccessToken });
      await user2Briefcase.pullChanges({ accessToken: user2AccessToken });
      await user2Briefcase.pushChanges({ description: "user2 pushing after pulling user1 changes", accessToken: user2AccessToken });
      await user1Briefcase.pullChanges({ accessToken: user1AccessToken });

      assert.isFalse(user1Briefcase.holdsSchemaLock);
      assert.isFalse(user1Briefcase.holdsSchemaTableLock);
      assert.isFalse(user2Briefcase.holdsSchemaLock);
      assert.isFalse(user2Briefcase.holdsSchemaTableLock);

      // verify schema and updated element on both sides
      for (const briefcase of [user1Briefcase, user2Briefcase]) {
        const entityClass = await briefcase.schemaContext.getSchemaItem(new SchemaItemKey("Test2dElement", new SchemaKey("TestDomain", 1, 0, 1)), EntityClass);
        assert.isDefined(entityClass, "Entity class should be defined");
        const user1Prop = await entityClass?.getProperty("MyPropertyForUser1");
        assert.isUndefined(user1Prop, "User1 property should not be present in final schema");
        const user2Prop = await entityClass?.getProperty("MyPropertyForUser2");
        assert.isDefined(user2Prop, "User2 property should be present in final schema");

        const finalElement = briefcase.elements.getElement(firstElementId);
        assert.equal((finalElement as any).myProperty, "UPDATED_VALUE", "Element property should be updated");
      }
    } finally {
      user1Briefcase?.close();
      user2Briefcase?.close();
      HubMock.shutdown();
    }
  });

  it("schema update with data changes - inserting base class in hierarchy", async () => {
    const iModelName = "SchemaDataChangeTest";
    const iTwinId = Guid.createValue();
    const user1AccessToken = "token 1";
    const user2AccessToken = "token 2";
    let user1Briefcase: BriefcaseDb | undefined;
    let user2Briefcase: BriefcaseDb | undefined;

    HubMock.startup("schemaDataChangeTest", KnownTestLocations.outputDir);

    try {
      const iModelId = await HubMock.createNewIModel({ iTwinId, iModelName, description: "TestSubject", accessToken: user1AccessToken });
      assert.isNotEmpty(iModelId);
      user1Briefcase = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId, accessToken: user1AccessToken });

      // Import initial schema: C -> A
      const initialSchema = `<?xml version="1.0" encoding="UTF-8"?>
      <ECSchema schemaName="NewBaseClass" alias="nbc" version="01.00.00" displayLabel="InsertNewBaseClassInMiddleOfExistingHierarchy" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
        <ECEntityClass typeName="A">
          <BaseClass>bis:GraphicalElement2d</BaseClass>
          <ECProperty propertyName="PropA" typeName="string"/>
        </ECEntityClass>
        <ECEntityClass typeName="C">
          <BaseClass>A</BaseClass>
          <ECProperty propertyName="PropC" typeName="string"/>
        </ECEntityClass>
        <ECEntityClass typeName="D">
          <BaseClass>A</BaseClass>
          <ECProperty propertyName="PropD" typeName="string"/>
        </ECEntityClass>
      </ECSchema>`;

      await user1Briefcase.importSchemaStrings([initialSchema]);
      user1Briefcase.saveChanges();
      assert.isFalse(user1Briefcase.holdsSchemaLock);
      assert.isTrue(user1Briefcase.holdsSchemaTableLock);
      await user1Briefcase.pushChanges({ description: "import initial schema", accessToken: user1AccessToken });

      // Insert an element of the new class
      await user1Briefcase.locks.acquireLocks({ shared: IModel.dictionaryId });
      const modelCode = IModelTestUtils.getUniqueModelCode(user1Briefcase, "DrawingModel");
      const [, drawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(user1Briefcase, modelCode);
      // Create a drawing category
      const drawingCategoryId = DrawingCategory.insert(user1Briefcase, IModel.dictionaryId, "DrawingCategory", new SubCategoryAppearance());
      const firstElementProps: GeometricElementProps & { propA?: string; propC?: string } = {
        classFullName: "NewBaseClass:C",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        propA: "FIRSTA",
        propC: "FIRSTC",
      };
      const firstElement = user1Briefcase.elements.createElement(firstElementProps);
      const firstElementId = user1Briefcase.elements.insertElement(firstElement.toJSON());
      assert.isTrue(firstElementId !== undefined, "First element should be inserted");
      user1Briefcase.saveChanges();

      await user1Briefcase.pushChanges({ description: "insert element of new class", accessToken: user1AccessToken });
      assert.isFalse(user1Briefcase.holdsSchemaLock);
      assert.isFalse(user1Briefcase.holdsSchemaTableLock);

      // Helper function to query and verify element properties
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const queryAndVerifyElement = async (briefcase: BriefcaseDb, context: string, expectedProps: { PropA: string; PropC: string }) => {
        const queryBinder = new QueryBinder();
        queryBinder.bindId(1, firstElementId);
        const reader = briefcase.createQueryReader("SELECT PropA, PropC FROM NewBaseClass.C WHERE ECInstanceId = ?", queryBinder);
        assert.isTrue(await reader.step(), `Should find element (${context})`);

        const result = reader.current.toRow();
        assert.deepEqual(result, expectedProps, `Element properties should match expected values (${context})`);
      };

      // Verify element immediately after insertion (before schema change)
      // eslint-disable-next-line @typescript-eslint/naming-convention
      await queryAndVerifyElement(user1Briefcase, "before schema change", { PropA: "FIRSTA", PropC: "FIRSTC" });

      // Open briefcase as user 2
      user2Briefcase = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId, accessToken: user2AccessToken });

      // Import updated schema that requires data transformation (moving property from C to A)
      const updatedSchemaUser2 = `<?xml version="1.0" encoding="UTF-8"?>
      <ECSchema schemaName="NewBaseClass" alias="nbc" version="01.01.00" displayLabel="InsertNewBaseClassInMiddleOfExistingHierarchy" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
        <ECEntityClass typeName="A">
          <BaseClass>bis:GraphicalElement2d</BaseClass>
          <ECProperty propertyName="PropA" typeName="string"/>
          <ECProperty propertyName="PropC" typeName="string"/>
        </ECEntityClass>
        <ECEntityClass typeName="C">
          <BaseClass>A</BaseClass>
          <ECProperty propertyName="PropC" typeName="string"/>
        </ECEntityClass>
        <ECEntityClass typeName="D">
          <BaseClass>A</BaseClass>
          <ECProperty propertyName="PropD" typeName="string"/>
        </ECEntityClass>
      </ECSchema>`;

      await user2Briefcase.importSchemaStrings([updatedSchemaUser2]);
      assert.isTrue(user2Briefcase.holdsSchemaLock, "Should hold full schema lock for data transformation");
      assert.isTrue(user2Briefcase.holdsSchemaTableLock, "Should not hold additive-only lock when holding full lock");
      user2Briefcase.saveChanges();

      // Try what user1 can do while user2 holds the full schema lock
      const updatedSchemaUser1 = `<?xml version="1.0" encoding="UTF-8"?>
      <ECSchema schemaName="NewBaseClass" alias="nbc" version="01.01.00" displayLabel="InsertNewBaseClassInMiddleOfExistingHierarchy" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
        <ECEntityClass typeName="A">
          <BaseClass>bis:GraphicalElement2d</BaseClass>
          <ECProperty propertyName="PropA" typeName="string"/>
          <ECProperty propertyName="PropD" typeName="string"/>
        </ECEntityClass>
        <ECEntityClass typeName="C">
          <BaseClass>A</BaseClass>
          <ECProperty propertyName="PropC" typeName="string"/>
        </ECEntityClass>
        <ECEntityClass typeName="D">
          <BaseClass>A</BaseClass>
          <ECProperty propertyName="PropD" typeName="string"/>
        </ECEntityClass>
      </ECSchema>`;

      // User1 should not be able to import a schema while user2 holds full schema lock
      await expect(user1Briefcase.importSchemaStrings([updatedSchemaUser1]))
        .to.be.rejectedWith("exclusive lock is already held");

      // User1 should also NOT be able to modify elements while user2 holds full schema lock
      const element = user1Briefcase.elements.getElement(firstElementId);
      (element as any).propA = "UPDATED_VALUE";
      await expect(user1Briefcase.locks.acquireLocks({ exclusive: firstElementId }))
        .to.be.rejectedWith("exclusive lock is already held");

      // User2 pushes the schema change
      await user2Briefcase.pushChanges({ description: "update schema with data transformation", accessToken: user2AccessToken });
      assert.isFalse(user2Briefcase.holdsSchemaLock);
      assert.isFalse(user2Briefcase.holdsSchemaTableLock);

      // User1 pulls the changes
      await user1Briefcase.pullChanges({ accessToken: user1AccessToken });

      // Now user1 should be able to modify the element
      await user1Briefcase.locks.acquireLocks({ exclusive: firstElementId });
      (element as any).propA = "UPDATED_VALUE";
      user1Briefcase.elements.updateElement(element.toJSON());
      user1Briefcase.saveChanges();
      await user1Briefcase.pushChanges({ description: "modify element after schema change", accessToken: user1AccessToken });

      await user2Briefcase.pullChanges({ accessToken: user2AccessToken });

      assert.isFalse(user1Briefcase.holdsSchemaLock);
      assert.isFalse(user1Briefcase.holdsSchemaTableLock);
      assert.isFalse(user2Briefcase.holdsSchemaLock);
      assert.isFalse(user2Briefcase.holdsSchemaTableLock);

      // Verify schema and element data on both sides
      for (const briefcase of [user1Briefcase, user2Briefcase]) {
        const entityClass = await briefcase.schemaContext.getSchemaItem(new SchemaItemKey("C", new SchemaKey("NewBaseClass", 1, 1, 0)), EntityClass);
        assert.isDefined(entityClass, "Entity class C should be defined");
        const baseClass = await briefcase.schemaContext.getSchemaItem(new SchemaItemKey("A", new SchemaKey("NewBaseClass", 1, 1, 0)), EntityClass);
        assert.isDefined(baseClass, "Entity class A should be defined");
        const propC = await baseClass?.getProperty("PropC");
        assert.isDefined(propC, "PropC should now be on base class A");

        const finalElement = briefcase.elements.getElement(firstElementId);
        assert.equal((finalElement as any).propA, "UPDATED_VALUE", "Element property should be updated");
        assert.equal((finalElement as any).propC, "FIRSTC", "Original property value should be preserved");
      }
    } catch (error) {
      if (!ITwinError.isError(error, "be-sqlite", "BE_SQLITE_ERROR_DataTransformRequired"))
        throw error;
    } finally {
      user1Briefcase?.close();
      user2Briefcase?.close();
      HubMock.shutdown();
    }
  });
});
