/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { Suite } from "mocha";
import { BriefcaseDb, DrawingCategory, IModelHost } from "@itwin/core-backend";
import { AzuriteTest } from "./AzuriteTest";
import { HubMock } from "@itwin/core-backend/lib/cjs/internal/HubMock";
import { HubWrappers, IModelTestUtils, KnownTestLocations } from "@itwin/core-backend/lib/cjs/test";
import { Guid } from "@itwin/core-bentley";
import { Code, GeometricElementProps, IModel, SubCategoryAppearance } from "@itwin/core-common";
import { EntityClass, SchemaItemKey, SchemaKey } from "@itwin/ecschema-metadata";

describe.only("Schema lock tests", function (this: Suite) {
  /** Test schemas with a basic hierarchy: C->A, D->A. PropC and PropD occupy the same shared column */
  const testSchemas = {
    /** Initial schema v01.00.00 */
    baseSchema: `<?xml version="1.0" encoding="UTF-8"?>
  <ECSchema schemaName="TestDomain" alias="td" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
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
  </ECSchema>`,

    /** Trivial additive schema change v01.00.01 - adds PropC2 to class C */
    trivialUpdate: `<?xml version="1.0" encoding="UTF-8"?>
  <ECSchema schemaName="TestDomain" alias="td" version="01.00.01" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
    <ECSchemaReference name="BisCore" version="01.00.23" alias="bis"/>
    <ECEntityClass typeName="A">
      <BaseClass>bis:GraphicalElement2d</BaseClass>
      <ECProperty propertyName="PropA" typeName="string"/>
    </ECEntityClass>
    <ECEntityClass typeName="C">
      <BaseClass>A</BaseClass>
      <ECProperty propertyName="PropC" typeName="string"/>
      <ECProperty propertyName="PropC2" typeName="string"/>
    </ECEntityClass>
    <ECEntityClass typeName="D">
      <BaseClass>A</BaseClass>
      <ECProperty propertyName="PropD" typeName="string"/>
    </ECEntityClass>
  </ECSchema>`,

    /** Data transformation required v01.01.00 - moves PropC from C to A (D still has PropD occupying shared column) */
    dataTransformUpdate: `<?xml version="1.0" encoding="UTF-8"?>
  <ECSchema schemaName="TestDomain" alias="td" version="01.01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
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
  </ECSchema>`,
  };

  const iTwinId: string = Guid.createValue();
  const iModelName = "SchemaLockTest";
  const user1Token = "token 1";
  const user2Token = "token 2";
  let iModelId: string;
  let briefcases: BriefcaseDb[] = [];

  /** Setup a new iModel and store the iModelId in shared context */
  const setupIModel = async (accessToken: string): Promise<void> => {
    iModelId = await HubMock.createNewIModel({ iTwinId, iModelName, description: "TestSubject", accessToken });
    assert.isNotEmpty(iModelId);
  };

  /** Open a briefcase for a user using shared iTwinId and iModelId */
  const openBriefcase = async (accessToken: string): Promise<BriefcaseDb> => {
    return HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId, accessToken });
  };

  /** Setup model and category for inserting elements, returns [modelId, categoryId] */
  const insertModelAndCategory = (briefcase: BriefcaseDb): [string, string] => {
    const modelCode = IModelTestUtils.getUniqueModelCode(briefcase, "DrawingModel");
    const [, drawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(briefcase, modelCode);
    const drawingCategoryId = DrawingCategory.insert(briefcase, IModel.dictionaryId, "DrawingCategory", new SubCategoryAppearance());
    return [drawingModelId, drawingCategoryId];
  };

  /** Insert an element of class TestDomain:C with PropA and PropC */
  const insertTestElement = (briefcase: BriefcaseDb, modelId: string, categoryId: string, propA: string, propC: string): string => {
    const elementProps: GeometricElementProps & { propA?: string; propC?: string } = {
      classFullName: "TestDomain:C",
      model: modelId,
      category: categoryId,
      code: Code.createEmpty(),
      propA,
      propC,
    };
    const element = briefcase.elements.createElement(elementProps);
    const elementId = briefcase.elements.insertElement(element.toJSON());
    assert.isTrue(elementId !== undefined, "Element should be inserted");
    return elementId;
  };

  /** Update an element's property */
  const updateElementProperty = (briefcase: BriefcaseDb, elementId: string, propertyName: string, value: string): void => {
    const element = briefcase.elements.getElement(elementId);
    (element as any)[propertyName] = value;
    briefcase.elements.updateElement(element.toJSON());
  };

  before(async () => {
    IModelHost.authorizationClient = new AzuriteTest.AuthorizationClient();
  });

  after(async () => {
    IModelHost.authorizationClient = undefined;
  });

  beforeEach(() => {
    HubMock.startup(iModelName, KnownTestLocations.outputDir);
  });

  afterEach(() => {
    briefcases.forEach((bc) => bc.close());
    briefcases = [];
    HubMock.shutdown();
  });

  it("trivial schema imports should use schema table lock", async () => {
    // Setup iModel
    await setupIModel(user1Token);
    const user1Briefcase = await openBriefcase(user1Token);
    briefcases.push(user1Briefcase);

    // Import base schema
    await user1Briefcase.importSchemaStrings([testSchemas.baseSchema]);
    user1Briefcase.saveChanges();
    assert.isFalse(user1Briefcase.holdsSchemaLock);
    assert.isTrue(user1Briefcase.holdsSchemaTableLock);
    await user1Briefcase.pushChanges({ description: "import schema", accessToken: user1Token });

    // Insert element using base schema
    await user1Briefcase.locks.acquireLocks({ shared: IModel.dictionaryId });
    const [modelId, categoryId] = insertModelAndCategory(user1Briefcase);
    const elementId = insertTestElement(user1Briefcase, modelId, categoryId, "INITIAL_A", "INITIAL_C");
    user1Briefcase.saveChanges();

    await user1Briefcase.pushChanges({ description: "insert element", accessToken: user1Token });
    assert.isFalse(user1Briefcase.holdsSchemaLock);
    assert.isFalse(user1Briefcase.holdsSchemaTableLock);

    // User2 opens briefcase and imports trivial schema update
    const user2Briefcase = await openBriefcase(user2Token);
    briefcases.push(user2Briefcase);
    await user2Briefcase.importSchemaStrings([testSchemas.trivialUpdate]);
    assert.isFalse(user2Briefcase.holdsSchemaLock);
    assert.isTrue(user2Briefcase.holdsSchemaTableLock);
    user2Briefcase.saveChanges();

    // User1 cannot import conflicting schema while user2 holds table lock
    await expect(user1Briefcase.importSchemaStrings([testSchemas.trivialUpdate]))
      .to.be.rejectedWith("exclusive lock is already held");

    // User1 can modify element while user2 holds table lock
    await user1Briefcase.locks.acquireLocks({ exclusive: elementId });
    updateElementProperty(user1Briefcase, elementId, "propA", "UPDATED_A");
    updateElementProperty(user1Briefcase, elementId, "propC", "UPDATED_C");
    user1Briefcase.saveChanges();
    await user1Briefcase.pushChanges({ description: "modify element", accessToken: user1Token });

    await user2Briefcase.pullChanges({ accessToken: user2Token });
    await user2Briefcase.pushChanges({ description: "push schema change", accessToken: user2Token });
    await user1Briefcase.pullChanges({ accessToken: user1Token });

    assert.isFalse(user1Briefcase.holdsSchemaLock);
    assert.isFalse(user1Briefcase.holdsSchemaTableLock);
    assert.isFalse(user2Briefcase.holdsSchemaLock);
    assert.isFalse(user2Briefcase.holdsSchemaTableLock);

    // Verify final state: user2's schema change won, element was updated
    for (const briefcase of [user1Briefcase, user2Briefcase]) {
      const entityClass = await briefcase.schemaContext.getSchemaItem(new SchemaItemKey("C", new SchemaKey("TestDomain", 1, 0, 1)), EntityClass);
      assert.isDefined(entityClass, "Entity class should be defined");
      const propC2 = await entityClass?.getProperty("PropC2");
      assert.isDefined(propC2, "PropC2 should be present (user2's change)");

      const element = briefcase.elements.getElement(elementId);
      assert.equal((element as any).propA, "UPDATED_A", "Element should have updated propA");
      assert.equal((element as any).propC, "UPDATED_C", "Element should have updated propC");
    }
  });

  it("trivial schema import reversed push pull order", async () => {
    // Same as previous test just a bit condensed and with swapped push/pull order to verify consistency
    // Setup iModel
    await setupIModel(user1Token);
    const user1Briefcase = await openBriefcase(user1Token);
    briefcases.push(user1Briefcase);

    // Import base schema
    await user1Briefcase.importSchemaStrings([testSchemas.baseSchema]);
    user1Briefcase.saveChanges();
    assert.isFalse(user1Briefcase.holdsSchemaLock);
    assert.isTrue(user1Briefcase.holdsSchemaTableLock);
    await user1Briefcase.pushChanges({ description: "import schema", accessToken: user1Token });

    // Insert element using base schema
    await user1Briefcase.locks.acquireLocks({ shared: IModel.dictionaryId });
    const [modelId, categoryId] = insertModelAndCategory(user1Briefcase);
    const elementId = insertTestElement(user1Briefcase, modelId, categoryId, "INITIAL_A", "INITIAL_C");
    user1Briefcase.saveChanges();

    await user1Briefcase.pushChanges({ description: "insert element", accessToken: user1Token });
    assert.isFalse(user1Briefcase.holdsSchemaLock);
    assert.isFalse(user1Briefcase.holdsSchemaTableLock);

    // User2 opens briefcase and imports trivial schema update
    const user2Briefcase = await openBriefcase(user2Token);
    briefcases.push(user2Briefcase);
    await user2Briefcase.importSchemaStrings([testSchemas.trivialUpdate]);
    assert.isFalse(user2Briefcase.holdsSchemaLock);
    assert.isTrue(user2Briefcase.holdsSchemaTableLock);
    user2Briefcase.saveChanges();

    // User1 cannot import conflicting schema while user2 holds table lock
    await expect(user1Briefcase.importSchemaStrings([testSchemas.trivialUpdate]))
      .to.be.rejectedWith("exclusive lock is already held");

    // User1 can modify element while user2 holds table lock
    await user1Briefcase.locks.acquireLocks({ exclusive: elementId });
    updateElementProperty(user1Briefcase, elementId, "propA", "UPDATED_A");
    updateElementProperty(user1Briefcase, elementId, "propC", "UPDATED_C");
    user1Briefcase.saveChanges();
    await user2Briefcase.pushChanges({ description: "push schema change", accessToken: user2Token });
    await user1Briefcase.pullChanges({ accessToken: user1Token });
    await user1Briefcase.pushChanges({ description: "modify element", accessToken: user1Token });
    await user2Briefcase.pullChanges({ accessToken: user2Token });

    assert.isFalse(user1Briefcase.holdsSchemaLock);
    assert.isFalse(user1Briefcase.holdsSchemaTableLock);
    assert.isFalse(user2Briefcase.holdsSchemaLock);
    assert.isFalse(user2Briefcase.holdsSchemaTableLock);

    // Verify final state: user2's schema change won, element was updated
    for (const briefcase of [user1Briefcase, user2Briefcase]) {
      const entityClass = await briefcase.schemaContext.getSchemaItem(new SchemaItemKey("C", new SchemaKey("TestDomain", 1, 0, 1)), EntityClass);
      assert.isDefined(entityClass, "Entity class should be defined");
      const propC2 = await entityClass?.getProperty("PropC2");
      assert.isDefined(propC2, "PropC2 should be present (user2's change)");

      const element = briefcase.elements.getElement(elementId);
      assert.equal((element as any).propA, "UPDATED_A", "Element should have updated propA");
      assert.equal((element as any).propC, "UPDATED_C", "Element should have updated propC");
    }
  });

  it("data transform schema update should block conflicting operations", async () => {
    // Setup iModel
    await setupIModel(user1Token);
    const user1Briefcase = await openBriefcase(user1Token);
    briefcases.push(user1Briefcase);

    // Import base schema
    await user1Briefcase.importSchemaStrings([testSchemas.baseSchema]);
    user1Briefcase.saveChanges();
    assert.isFalse(user1Briefcase.holdsSchemaLock);
    assert.isTrue(user1Briefcase.holdsSchemaTableLock);
    await user1Briefcase.pushChanges({ description: "import initial schema", accessToken: user1Token });

    // Insert element using base schema
    await user1Briefcase.locks.acquireLocks({ shared: IModel.dictionaryId });
    const [modelId, categoryId] = insertModelAndCategory(user1Briefcase);
    const elementId = insertTestElement(user1Briefcase, modelId, categoryId, "INITIAL_A", "INITIAL_C");
    user1Briefcase.saveChanges();

    await user1Briefcase.pushChanges({ description: "insert element", accessToken: user1Token });
    assert.isFalse(user1Briefcase.holdsSchemaLock);
    assert.isFalse(user1Briefcase.holdsSchemaTableLock);

    // User2 opens and imports data transformation schema
    const user2Briefcase = await openBriefcase(user2Token);
    briefcases.push(user2Briefcase);
    await user2Briefcase.importSchemaStrings([testSchemas.dataTransformUpdate]);
    assert.isTrue(user2Briefcase.holdsSchemaLock, "Should hold full schema lock for data transformation");
    assert.isTrue(user2Briefcase.holdsSchemaTableLock);
    user2Briefcase.saveChanges();

    // User1 cannot import schema while user2 holds full lock
    await expect(user1Briefcase.importSchemaStrings([testSchemas.trivialUpdate]))
      .to.be.rejectedWith("exclusive lock is already held");

    // User1 cannot modify elements while user2 holds full lock
    await expect(user1Briefcase.locks.acquireLocks({ exclusive: elementId }))
      .to.be.rejectedWith("exclusive lock is already held");

    // User2 pushes schema change
    await user2Briefcase.pushChanges({ description: "data transformation schema", accessToken: user2Token });
    assert.isFalse(user2Briefcase.holdsSchemaLock);
    assert.isFalse(user2Briefcase.holdsSchemaTableLock);

    // User1 pulls and can now modify
    await user1Briefcase.pullChanges({ accessToken: user1Token });
    await user1Briefcase.locks.acquireLocks({ exclusive: elementId });
    updateElementProperty(user1Briefcase, elementId, "propA", "UPDATED_A");
    updateElementProperty(user1Briefcase, elementId, "propC", "UPDATED_C");
    user1Briefcase.saveChanges();
    await user1Briefcase.pushChanges({ description: "modify element", accessToken: user1Token });

    await user2Briefcase.pullChanges({ accessToken: user2Token });

    assert.isFalse(user1Briefcase.holdsSchemaLock);
    assert.isFalse(user1Briefcase.holdsSchemaTableLock);
    assert.isFalse(user2Briefcase.holdsSchemaLock);
    assert.isFalse(user2Briefcase.holdsSchemaTableLock);

    // Verify PropC moved to base class A and element data preserved
    for (const briefcase of [user1Briefcase, user2Briefcase]) {
      const baseClass = await briefcase.schemaContext.getSchemaItem(new SchemaItemKey("A", new SchemaKey("TestDomain", 1, 1, 0)), EntityClass);
      assert.isDefined(baseClass, "Base class A should be defined");
      const propC = await baseClass?.getProperty("PropC");
      assert.isDefined(propC, "PropC should be on base class A after transformation");

      const element = briefcase.elements.getElement(elementId);
      assert.equal((element as any).propA, "UPDATED_A");
      assert.equal((element as any).propC, "UPDATED_C", "PropC value updated after transformation");
    }
  });

  it("Pending incoming data transform change with local element update", async () => {
    // Setup iModel
    await setupIModel(user1Token);
    const user1Briefcase = await openBriefcase(user1Token);
    briefcases.push(user1Briefcase);

    // Import base schema
    await user1Briefcase.importSchemaStrings([testSchemas.baseSchema]);
    user1Briefcase.saveChanges();
    assert.isFalse(user1Briefcase.holdsSchemaLock);
    assert.isTrue(user1Briefcase.holdsSchemaTableLock);
    await user1Briefcase.pushChanges({ description: "import initial schema", accessToken: user1Token });

    // Insert element using base schema
    await user1Briefcase.locks.acquireLocks({ shared: IModel.dictionaryId });
    const [modelId, categoryId] = insertModelAndCategory(user1Briefcase);
    const elementId = insertTestElement(user1Briefcase, modelId, categoryId, "INITIAL_A", "INITIAL_C");

    // Insert a second element which will not be modified later, so we can verify data transformation worked correctly
    const secondElementId = insertTestElement(user1Briefcase, modelId, categoryId, "SECOND_ELEM_A", "SECOND_ELEM_C");

    user1Briefcase.saveChanges();
    await user1Briefcase.pushChanges({ description: "insert element", accessToken: user1Token });
    assert.isFalse(user1Briefcase.holdsSchemaLock);
    assert.isFalse(user1Briefcase.holdsSchemaTableLock);

    // User2 opens, imports data transformation schema and pushes it which releases locks
    const user2Briefcase = await openBriefcase(user2Token);
    briefcases.push(user2Briefcase);
    await user2Briefcase.importSchemaStrings([testSchemas.dataTransformUpdate]);
    assert.isTrue(user2Briefcase.holdsSchemaLock, "Should hold full schema lock for data transformation");
    assert.isTrue(user2Briefcase.holdsSchemaTableLock);
    user2Briefcase.saveChanges();
    await user2Briefcase.pushChanges({ description: "data transformation schema", accessToken: user2Token });
    assert.isFalse(user2Briefcase.holdsSchemaLock);
    assert.isFalse(user2Briefcase.holdsSchemaTableLock);

    // User1 now has a pending incoming schema change
    // User1 modifies element locally
    await user1Briefcase.locks.acquireLocks({ exclusive: elementId });
    updateElementProperty(user1Briefcase, elementId, "propA", "UPDATED_A");
    updateElementProperty(user1Briefcase, elementId, "propC", "UPDATED_C");
    user1Briefcase.saveChanges();
    // We push directly without pulling - however, push implicitly pulls first, so this does not fail.
    await user1Briefcase.pushChanges({ description: "modify element", accessToken: user1Token });

    await user2Briefcase.pullChanges({ accessToken: user2Token });

    assert.isFalse(user1Briefcase.holdsSchemaLock);
    assert.isFalse(user1Briefcase.holdsSchemaTableLock);
    assert.isFalse(user2Briefcase.holdsSchemaLock);
    assert.isFalse(user2Briefcase.holdsSchemaTableLock);

    // Verify PropC moved to base class A and element data preserved
    for (const briefcase of [user1Briefcase, user2Briefcase]) {
      const baseClass = await briefcase.schemaContext.getSchemaItem(new SchemaItemKey("A", new SchemaKey("TestDomain", 1, 1, 0)), EntityClass);
      assert.isDefined(baseClass, "Base class A should be defined");
      const propC = await baseClass?.getProperty("PropC");
      assert.isDefined(propC, "PropC should be on base class A after transformation");

      const element = briefcase.elements.getElement(elementId);
      assert.equal((element as any).propA, "UPDATED_A");
      assert.equal((element as any).propC, "UPDATED_C", "PropC value updated after transformation");

      const secondElement = briefcase.elements.getElement(secondElementId);
      assert.equal((secondElement as any).propA, "SECOND_ELEM_A");
      assert.equal((secondElement as any).propC, "SECOND_ELEM_C", "Second element PropC value preserved through transformation");
    }
  });

  it("Pending incoming element update with local data transform change", async () => {
    // Setup iModel
    await setupIModel(user1Token);
    const user1Briefcase = await openBriefcase(user1Token);
    briefcases.push(user1Briefcase);

    // Import base schema
    await user1Briefcase.importSchemaStrings([testSchemas.baseSchema]);
    user1Briefcase.saveChanges();
    assert.isFalse(user1Briefcase.holdsSchemaLock);
    assert.isTrue(user1Briefcase.holdsSchemaTableLock);
    await user1Briefcase.pushChanges({ description: "import initial schema", accessToken: user1Token });

    // Insert element using base schema
    await user1Briefcase.locks.acquireLocks({ shared: IModel.dictionaryId });
    const [modelId, categoryId] = insertModelAndCategory(user1Briefcase);
    const elementId = insertTestElement(user1Briefcase, modelId, categoryId, "INITIAL_A", "INITIAL_C");

    // Insert a second element which will not be modified later, so we can verify data transformation worked correctly
    const secondElementId = insertTestElement(user1Briefcase, modelId, categoryId, "SECOND_ELEM_A", "SECOND_ELEM_C");

    user1Briefcase.saveChanges();
    await user1Briefcase.pushChanges({ description: "insert element", accessToken: user1Token });
    assert.isFalse(user1Briefcase.holdsSchemaLock);
    assert.isFalse(user1Briefcase.holdsSchemaTableLock);
    const user2Briefcase = await openBriefcase(user2Token);
    briefcases.push(user2Briefcase);

    // User1 modifies element locally
    await user1Briefcase.locks.acquireLocks({ exclusive: elementId });
    updateElementProperty(user1Briefcase, elementId, "propA", "UPDATED_A");
    updateElementProperty(user1Briefcase, elementId, "propC", "UPDATED_C");
    user1Briefcase.saveChanges();
    // We push directly without pulling - however, push implicitly pulls first, so this does not fail.
    await user1Briefcase.pushChanges({ description: "modify element", accessToken: user1Token });

    // User2 imports data transformation schema and pushes it which releases locks
    await user2Briefcase.importSchemaStrings([testSchemas.dataTransformUpdate]);
    assert.isTrue(user2Briefcase.holdsSchemaLock, "Should hold full schema lock for data transformation");
    assert.isTrue(user2Briefcase.holdsSchemaTableLock);
    user2Briefcase.saveChanges();
    await user2Briefcase.pushChanges({ description: "data transformation schema", accessToken: user2Token });
    assert.isFalse(user2Briefcase.holdsSchemaLock);
    assert.isFalse(user2Briefcase.holdsSchemaTableLock);

    // User1 now has a pending incoming schema change
    await user1Briefcase.pullChanges({ accessToken: user2Token });

    assert.isFalse(user1Briefcase.holdsSchemaLock);
    assert.isFalse(user1Briefcase.holdsSchemaTableLock);
    assert.isFalse(user2Briefcase.holdsSchemaLock);
    assert.isFalse(user2Briefcase.holdsSchemaTableLock);

    // Verify PropC moved to base class A and element data preserved
    for (const briefcase of [user1Briefcase, user2Briefcase]) {
      const baseClass = await briefcase.schemaContext.getSchemaItem(new SchemaItemKey("A", new SchemaKey("TestDomain", 1, 1, 0)), EntityClass);
      assert.isDefined(baseClass, "Base class A should be defined");
      const propC = await baseClass?.getProperty("PropC");
      assert.isDefined(propC, "PropC should be on base class A after transformation");

      const element = briefcase.elements.getElement(elementId);
      assert.equal((element as any).propA, "UPDATED_A");
      assert.equal((element as any).propC, "UPDATED_C", "PropC value updated after transformation");

      const secondElement = briefcase.elements.getElement(secondElementId);
      assert.equal((secondElement as any).propA, "SECOND_ELEM_A");
      assert.equal((secondElement as any).propC, "SECOND_ELEM_C", "Second element PropC value preserved through transformation");
    }
  });
});
