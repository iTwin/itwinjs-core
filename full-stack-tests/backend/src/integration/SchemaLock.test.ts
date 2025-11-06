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
import { Guid } from "@itwin/core-bentley";
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
      assert.isTrue(user1Briefcase.holdsAdditiveSchemaChangeOnlyLock);
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
      assert.isFalse(user1Briefcase.holdsAdditiveSchemaChangeOnlyLock);

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
      assert.isTrue(user2Briefcase.holdsAdditiveSchemaChangeOnlyLock);
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
      assert.isFalse(user1Briefcase.holdsAdditiveSchemaChangeOnlyLock);
      assert.isFalse(user2Briefcase.holdsSchemaLock);
      assert.isFalse(user2Briefcase.holdsAdditiveSchemaChangeOnlyLock);

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
    const accessToken = "token 1";
    let briefcase: BriefcaseDb | undefined;

    HubMock.startup("schemaDataChangeTest", KnownTestLocations.outputDir);

    try {
      const iModelId = await HubMock.createNewIModel({ iTwinId, iModelName, description: "TestSubject", accessToken });
      assert.isNotEmpty(iModelId);
      briefcase = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId, accessToken });

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
      </ECSchema>`;

      await briefcase.importSchemaStrings([initialSchema]);

      await briefcase.locks.acquireLocks({ shared: IModel.dictionaryId });
      // Create a drawing partition and model for 2D elements
      const modelCode = IModelTestUtils.getUniqueModelCode(briefcase, "DrawingModel");
      const [, drawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(briefcase, modelCode);

      // Create a drawing category
      const drawingCategoryId = DrawingCategory.insert(briefcase, IModel.dictionaryId, "DrawingCategory", new SubCategoryAppearance());

      // Create element props for class C

      const firstElementProps: GeometricElementProps & { propA?: string; propC?: string } = {
        classFullName: "NewBaseClass:C",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        propA: "FIRSTA",
        propC: "FIRSTC",
      };

      const firstElement = briefcase.elements.createElement(firstElementProps);
      const firstElementId = briefcase.elements.insertElement(firstElement.toJSON());
      assert.isTrue(firstElementId !== undefined, "First element should be inserted");
      briefcase.saveChanges();
      await briefcase.pushChanges({ description: "import initial schema and insert first element", accessToken });

      // Helper function to query and verify element properties
      const queryAndVerifyElement = async (context: string) => {
        const queryBinder = new QueryBinder();
        queryBinder.bindId(1, firstElementId);
        const reader = briefcase!.createQueryReader("SELECT PropA, PropC FROM NewBaseClass.C WHERE ECInstanceId = ?", queryBinder);
        assert.isTrue(await reader.step(), `Should find element (${context})`);

        const result = reader.current.toRow();
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const expected = { PropA: "FIRSTA", PropC: "FIRSTC" };
        assert.deepEqual(result, expected, `Element properties should match expected values (${context})`);
      };

      // Verify element immediately after insertion (before schema change)
      await queryAndVerifyElement("before schema change");

      // Import updated schema: C -> B -> A (B is inserted in the middle)
      const updatedSchema = `<?xml version="1.0" encoding="UTF-8"?>
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
      </ECSchema>`;

      await briefcase.importSchemaStrings([updatedSchema]);

      //TODO: Verify we're holding a full lock here (since importSchemas had data changes)

      briefcase.saveChanges();
      await briefcase.pushChanges({ description: "update schema with new base class", accessToken });

      // Verify element after schema change - data should be preserved
      await queryAndVerifyElement("after schema change");
    } finally {
      briefcase?.close();
      HubMock.shutdown();
    }
  });
});
