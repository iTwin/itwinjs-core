/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { Id64, Id64String } from "@itwin/core-bentley";
import {
  Code, ColorByName, ColorDef, GeometricElementProps, IModel, IModelError, QueryBinder, RelatedElement, RelationshipProps, SubCategoryAppearance,
} from "@itwin/core-common";
import { EntityClass } from "@itwin/ecschema-metadata";
import { EditTxn, withEditTxn } from "../../EditTxn";
import {
  ElementDrivesElement, ElementGroupsMembers, ElementGroupsMembersProps, GeometricModel, IModelDb, IModelJsFs, PhysicalModel,
  PhysicalObject, SnapshotDb, SpatialCategory, StandaloneDb,
} from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { TestUtils } from "../TestUtils";
import { generateTestSnapshot } from "./IModelTestFixtures";


function createElemProps(_imodel: IModelDb, modId: Id64String, catId: Id64String, className: string): GeometricElementProps {
  const elementProps: GeometricElementProps = {
    classFullName: className,
    model: modId,
    category: catId,
    code: Code.createEmpty(),
  };
  return elementProps;
}

function insertElement(imodel: IModelDb, mId: Id64String, cId: Id64String, cName: string, propName: string, txn: EditTxn): Id64String {
  const elementProps = createElemProps(imodel, mId, cId, cName);
  const geomElement = imodel.elements.createElement(elementProps);
  (geomElement as any).name = propName; // Add a custom property to the element
  const id = txn.insertElement(geomElement.toJSON());
  assert.isTrue(Id64.isValidId64(id), "insert failed");
  return id;
}

function validateADrivesBRowCount(imodel: IModelDb, expectedRows: number): void {
  const reader = IModelTestUtils.executeQuery(imodel, `select * from trs.ADrivesB`);
  assert.strictEqual(reader.length, expectedRows, `Expected ${expectedRows} rows in trs.ADrivesB table`);
}

function validateNavProp(imodel: IModelDb, expectedNavPropValue: any): void {
  const reader = IModelTestUtils.executeQuery(imodel, `select NavPropChildB from trs.ChildA`);
  assert.strictEqual(reader.length, 1);
  assert.deepEqual(reader[0].navPropChildB, expectedNavPropValue, `Expected NavPropChildB to be "${expectedNavPropValue}"`);
}

describe("iModel relationships", () => {
  before(async () => {
    await TestUtils.startBackend();
    IModelTestUtils.registerTestBimSchema();
  });

  describe("with a writable seed iModel", () => {
    let imodel: SnapshotDb;

    beforeEach(async () => {
      imodel = await generateTestSnapshot("relationships.bim", "test.bim");
    });

    afterEach(() => {
      if (imodel !== undefined && imodel.isOpen)
        imodel.close();
    });

    it("should create model with custom relationship to modeled element", async () => {
      const testImodel = imodel;
      const txn = new EditTxn(testImodel, "custom relationship to modeled element");

      assert.doesNotThrow(() => testImodel.schemaContext.getSchemaItemSync("TestBim:TestModelModelsElement", EntityClass), "TestModelModelsElement is expected to be defined in TestBim.ecschema.xml");

      txn.start();
      const newPartition1 = IModelTestUtils.createAndInsertPhysicalPartition(txn, Code.createEmpty());
      const relClassName1 = "TestBim:TestModelModelsElement";
      const modeledElementRef = new RelatedElement({ id: newPartition1, relClassName: relClassName1 });
      const newModelId1 = IModelTestUtils.createAndInsertPhysicalModel(txn, modeledElementRef);
      assert.isTrue(Id64.isValidId64(newModelId1));
      const [, newModelId2] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(txn, Code.createEmpty());
      txn.end();
      const newModel2 = testImodel.models.getModel(newModelId2);
      const relClassName2 = newModel2.modeledElement.relClassName;

      const model1 = testImodel.models.getModel(newModelId1);
      const model2 = testImodel.models.getModel(newModelId2);

      const foundRelClassName1 = model1.modeledElement.relClassName;
      const foundRelClassName2 = model2.modeledElement.relClassName;

      assert.equal(foundRelClassName1, relClassName1);
      assert.equal(foundRelClassName2, relClassName2);
    });
  });

  it("should create link table relationship instances", () => {
    const snapshotFile2: string = IModelTestUtils.prepareOutputFile("IModel", "CreateLinkTable.bim");
    const testImodel = StandaloneDb.createEmpty(snapshotFile2, { rootSubject: { name: "test1" }, enableTransactions: true });
    const txn = new EditTxn(testImodel, "link table relationship instances");
    txn.start();
    // Create a new physical model
    const newModelId = PhysicalModel.insert(txn, IModel.rootSubjectId, "TestModel");

    // create a SpatialCategory
    const spatialCategoryId = SpatialCategory.insert(txn, IModel.dictionaryId, "MySpatialCategory", new SubCategoryAppearance({ color: ColorByName.darkRed }));

    // Create a couple of physical elements.
    const elementProps: GeometricElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: newModelId,
      category: spatialCategoryId,
      code: Code.createEmpty(),
    };

    const id0 = txn.insertElement(elementProps);
    const id1 = txn.insertElement(elementProps);
    const id2 = txn.insertElement(elementProps);

    const geometricModel = testImodel.models.getModel<GeometricModel>(newModelId);
    assert.throws(() => geometricModel.queryExtents()); // no geometry

    // Create grouping relationships from 0 to 1 and from 0 to 2
    const r1 = ElementGroupsMembers.create(testImodel, id0, id1, 1);
    r1.id = txn.insertRelationship(r1.toJSON());
    const r2 = ElementGroupsMembers.create(testImodel, id0, id2);
    r2.id = txn.insertRelationship(r2.toJSON());

    // Look up by id
    const g1 = ElementGroupsMembers.getInstance<ElementGroupsMembers>(testImodel, r1.id);
    const g2 = ElementGroupsMembers.getInstance<ElementGroupsMembers>(testImodel, r2.id);

    assert.deepEqual(g1.id, r1.id);
    assert.equal(g1.classFullName, ElementGroupsMembers.classFullName);
    assert.equal(g1.memberPriority, 1, "g1.memberPriority");
    assert.deepEqual(g2.id, r2.id);
    assert.equal(g2.classFullName, ElementGroupsMembers.classFullName);
    assert.equal(g2.memberPriority, 0, "g2.memberPriority");  // The memberPriority parameter defaults to 0 in ElementGroupsMembers.create

    // Look up by source and target
    const g1byst = ElementGroupsMembers.getInstance<ElementGroupsMembers>(testImodel, { sourceId: r1.sourceId, targetId: r1.targetId });
    assert.deepEqual(g1byst, g1);

    // Update relationship instance property
    r1.asAny.memberPriority = 2;
    txn.updateRelationship(r1.toJSON());

    const g11 = ElementGroupsMembers.getInstance<ElementGroupsMembers>(testImodel, r1.id);
    assert.equal(g11.memberPriority, 2, "g11.memberPriority");
    txn.saveChanges("step 1");

    // Delete relationship instance property
    txn.deleteRelationship(g11.toJSON());
    txn.saveChanges("step 2");
    assert.throws(() => ElementGroupsMembers.getInstance(testImodel, r1.id), IModelError);

    const d0 = txn.insertElement(elementProps);
    const d1 = txn.insertElement(elementProps);
    const ede1 = ElementDrivesElement.create(testImodel, d0, d1, 0);
    ede1.id = txn.insertRelationship(ede1.toJSON());
    txn.saveChanges("step 3");

    txn.deleteRelationship(ede1.toJSON());
    txn.end("save", "step 4");
    testImodel.close();
  });

  it("should throw \"constraint failed (BE_SQLITE_CONSTRAINT_UNIQUE)\" when inserting a relationship instance with the same prop twice", () => {
    const imodelPath = IModelTestUtils.prepareOutputFile("IModel", "insertDuplicateInstance.bim");
    const imodel = SnapshotDb.createEmpty(imodelPath, { rootSubject: { name: "insertDuplicateInstance" } });
    const txn = new EditTxn(imodel, "insert duplicate relationship instance");
    txn.start();
    // Create a new physical model
    const newModelId = PhysicalModel.insert(txn, IModel.rootSubjectId, "TestModel");

    // create a SpatialCategory
    const spatialCategoryId = SpatialCategory.insert(txn, IModel.dictionaryId, "MySpatialCategory", new SubCategoryAppearance({ color: ColorByName.darkRed }));

    // Create a couple of physical elements.
    const elementProps: GeometricElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: newModelId,
      category: spatialCategoryId,
      code: Code.createEmpty(),
    };

    const id0 = txn.insertElement(elementProps);
    const id1 = txn.insertElement(elementProps);

    const props: ElementGroupsMembersProps = {
      classFullName: "BisCore:ElementGroupsMembers",
      sourceId: id0,
      targetId: id1,
      memberPriority: 1,
    };

    txn.insertRelationship(props);
    expect(() => txn.insertRelationship(props)).to.throw(`Failed to insert relationship [${imodelPath}]: rc=2067, constraint failed (BE_SQLITE_CONSTRAINT_UNIQUE)`);

    txn.end("abandon");
    imodel.close();
  });

  it("Validate invalid relationship classes being inserted/updated", async () => {
    const imodelPath = IModelTestUtils.prepareOutputFile("IModel", "invalidRelationshipClass.bim");

    if (IModelJsFs.existsSync(imodelPath))
      IModelJsFs.unlinkSync(imodelPath);

    const testImodel = SnapshotDb.createEmpty(imodelPath, { rootSubject: { name: "invalidRelationshipClass" } });

    await testImodel.importSchemaStrings([
      `<?xml version="1.0" encoding="UTF-8"?>
      <ECSchema schemaName="TestRelationSchema" alias="trs" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
          <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
          <ECEntityClass typeName="TestElement">
              <BaseClass>bis:PhysicalElement</BaseClass>
              <ECProperty propertyName="Name" typeName="string" />
          </ECEntityClass>

          <ECEntityClass typeName="ChildA" >
            <BaseClass>TestElement</BaseClass>
            <ECNavigationProperty propertyName="NavPropChildB" relationshipName="ADrivesB" direction="Forward" readOnly="True">
            </ECNavigationProperty>
          </ECEntityClass>

          <ECEntityClass typeName="ChildB" >
            <BaseClass>TestElement</BaseClass>
          </ECEntityClass>

          <ECRelationshipClass typeName="ADrivesB" strengthDirection="Backward" strength="referencing" modifier="Sealed">
            <Source multiplicity="(0..*)" polymorphic="true" roleLabel="drives">
              <Class class="ChildA"/>
            </Source>
            <Target multiplicity="(0..1)" polymorphic="true" roleLabel="is driven by">
              <Class class="ChildB"/>
            </Target>
          </ECRelationshipClass>

          <ECEntityClass typeName="ChildC">
            <BaseClass>TestElement</BaseClass>
          </ECEntityClass>

          <ECEntityClass typeName="ChildD">
            <BaseClass>TestElement</BaseClass>
          </ECEntityClass>

          <ECRelationshipClass typeName="CIsRelatedToD" strength="referencing" modifier="Sealed">
             <BaseClass>bis:ElementRefersToElements</BaseClass>
            <Source multiplicity="(0..*)" roleLabel="IsRelatedTo" polymorphic="true">
              <Class class="ChildC"/>
            </Source>
            <Target multiplicity="(0..*)" roleLabel="IsRelatedTo (Reversed)" polymorphic="true">
              <Class class="ChildD"/>
            </Target>
          </ECRelationshipClass>
        </ECSchema>`]);

    // Enable ECSQL write validation and verify it's set
    const pragmaRows = IModelTestUtils.executeQuery(testImodel, `PRAGMA validate_ecsql_writes=true`);
    assert.exists(pragmaRows);
    assert.strictEqual(pragmaRows[0].validate_ecsql_writes, true);

    // Ensure ADrivesB table is empty before test
    validateADrivesBRowCount(testImodel, 0);

    // Create a physical model and spatial category if needed
    const setupTxn = new EditTxn(testImodel, "setup invalid relationship class test");
    setupTxn.start();
    const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(setupTxn, Code.createEmpty(), true);
    const spatialCategoryId = SpatialCategory.queryCategoryIdByName(testImodel, IModel.dictionaryId, "MySpatialCategory")
      ?? SpatialCategory.insert(setupTxn,
        IModel.dictionaryId,
        "MySpatialCategory",
        new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() })
      );
    const idB = insertElement(testImodel, newModelId, spatialCategoryId, "TestRelationSchema:ChildB", "ChildBElement", setupTxn);
    setupTxn.end();
    assert.isTrue(Id64.isValidId64(idB), "Insert ChildBElement failed");

    // Prepare base props for ChildA
    const elementProps = createElemProps(testImodel, newModelId, spatialCategoryId, "TestRelationSchema:ChildA");

    // Test various relationship class names for navigation property
    const testCases = [
      { name: "trs:ADrivesB", shouldSucceed: true, expectedRows: 1 },
      { name: "trs.FakeClass", shouldSucceed: true, expectedRows: 0 },
      { name: "trs:ChildA", shouldSucceed: false, expectedRows: 0 },
      { name: "trs:ChildB", shouldSucceed: false, expectedRows: 0 },
      { name: "trs:CIsRelatedToD", shouldSucceed: false, expectedRows: 0 },
    ];

    for (const { name, shouldSucceed, expectedRows } of testCases) {
      const txn = new EditTxn(testImodel, `invalid relationship class ${name}`);
      txn.start();
      try {
        const elemRef = new RelatedElement({ id: idB, relClassName: name });
        (elementProps as any).navPropChildB = elemRef;
        (elementProps as any).name = "ChildAElement";
        const geomElement = testImodel.elements.createElement(elementProps);

        let idA: Id64String | undefined;
        try {
          idA = txn.insertElement(geomElement.toJSON());
          if (shouldSucceed)
            assert.isTrue(Id64.isValidId64(idA), `Insert should have succeeded for ${name}.`);
          else
            assert.fail(`Insert should have failed for ${name}.`);
        } catch (err: any) {
          if (shouldSucceed)
            assert.fail(`Insert should have succeeded for ${name}. Error: ${err.message}`);

          // If should not succeed, error is expected
        }

        // Validate row count in ADrivesB table
        validateADrivesBRowCount(testImodel, expectedRows);

        // If insert succeeded, test update and delete scenarios
        if (expectedRows === 1 && idA !== undefined) {
          validateNavProp(testImodel, { id: idB, relClassName: "TestRelationSchema.ADrivesB" });

          const editElem: any = testImodel.elements.getElement(idA);
          editElem.navPropChildB = new RelatedElement({ id: idB, relClassName: "trs.FakeClass" });
          editElem.name = "ChildAElementUpdated";
          txn.updateElement(editElem);

          validateADrivesBRowCount(testImodel, 1);
          validateNavProp(testImodel, { id: idB, relClassName: "TestRelationSchema.ADrivesB" });

          const editedElem: any = testImodel.elements.getElement(idA);
          assert.equal(editedElem.name, "ChildAElementUpdated", `Expected name to be "ChildAElementUpdated" after update, but got "${editedElem.name}"`);
          assert.strictEqual(editedElem.navPropChildB.relClassName, "TestRelationSchema.ADrivesB", `Expected navPropChildB to be "TestRelationSchema.ADrivesB" after update, but got "${editedElem.navPropChildB}"`);

          // Set the nav prop value to null
          editElem.name = "ChildAElementNulled";
          editElem.navPropChildB = null;
          txn.updateElement(editElem);

          validateADrivesBRowCount(testImodel, 0);
          const nulledElem: any = testImodel.elements.getElement(idA);
          assert.equal(nulledElem.name, "ChildAElementNulled", `Expected name to be "ChildAElementNulled" after nulling, but got "${nulledElem.name}"`);
          assert.isUndefined(nulledElem.navPropChildB, `Expected navPropChildB to be undefined after nulling, but got "${nulledElem.navPropChildB}"`);

          if (shouldSucceed) {
            txn.deleteElement(idA);
            assert.isUndefined(testImodel.elements.tryGetElement(idA), `Expected element with id ${idA} to be deleted, but it still exists.`);
          }
        }
      } finally {
        txn.end("abandon");
      }
    }
    testImodel.close();
  });

  describe("Delete relationship instances", () => {
    let testImodel: SnapshotDb;
    const relationshipClasses = [
      "BisCore:ElementGroupsMembers",
      "BisCore:ElementDrivesElement",
      "BisCore:ElementRefersToDocuments"
    ];

    afterEach(() => {
      if (testImodel !== undefined) {
        const iModelPath = testImodel.pathName;
        if (testImodel.isOpen)
          testImodel.close();
        IModelJsFs.unlinkSync(iModelPath);
      }
    });

    function setupRelationships(numOfRelationships: number, multipleClasses: boolean = false): RelationshipProps[] {
      testImodel = SnapshotDb.createEmpty(IModelTestUtils.prepareOutputFile("IModel", "DeleteRelationshipInstances.bim"), { rootSubject: { name: "DeleteRelationshipInstances" } });
      assert.isTrue(testImodel.isOpen);

      const txn = new EditTxn(testImodel, "setup delete relationships");
      txn.start();
      const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(txn, Code.createEmpty(), true);
      let spatialCategoryId = SpatialCategory.queryCategoryIdByName(testImodel, IModel.dictionaryId, "MySpatialCategory");
      if (!spatialCategoryId) {
        spatialCategoryId = SpatialCategory.insert(txn, IModel.dictionaryId, "MySpatialCategory", new SubCategoryAppearance());
      }

      const relationships: RelationshipProps[] = [];
      for (let i = 0; i < numOfRelationships; ++i) {
        const sourceProps = createElemProps(testImodel, newModelId, spatialCategoryId, "Generic:PhysicalObject");
        const sourceId = txn.insertElement(sourceProps);

        const targetProps = createElemProps(testImodel, newModelId, spatialCategoryId, "Generic:PhysicalObject");
        const targetId = txn.insertElement(targetProps);

        let relationshipClass = "BisCore:ElementGroupsMembers";
        if (multipleClasses)
          relationshipClass = relationshipClasses[i % relationshipClasses.length];

        const relationshipProps: RelationshipProps = {
          classFullName: relationshipClass,
          sourceId,
          targetId,
        };

        relationshipProps.id = txn.insertRelationship(relationshipProps);
        relationships.push(relationshipProps);
      }
      txn.end();
      return relationships;
    }

    async function getRelationshipCount(iModel: IModelDb, relationshipClass: string): Promise<number> {
      const reader = iModel.createQueryReader(`SELECT COUNT(*) AS [count] FROM ${relationshipClass}`);
      await reader.step();
      return reader.current.count;
    }

    it("deleteInstances with an empty array", async () => {
      const relationships = setupRelationships(10);
      assert.equal(relationships.length, await getRelationshipCount(testImodel, "BisCore.ElementGroupsMembers"));

      withEditTxn(testImodel, (txn) => {
        txn.deleteRelationships([]);
      });

      assert.equal(relationships.length, await getRelationshipCount(testImodel, "BisCore.ElementGroupsMembers"));
    });

    it("deleteInstances with a single relationship instance", async () => {
      const relationships = setupRelationships(10);
      assert.equal(relationships.length, await getRelationshipCount(testImodel, "BisCore.ElementGroupsMembers"), "Should delete exactly one relationship");

      // Delete just one relationship using deleteInstances method
      withEditTxn(testImodel, (txn) => {
        txn.deleteRelationships([relationships[0]]);
      });

      const remainingCount = await getRelationshipCount(testImodel, "BisCore.ElementGroupsMembers");
      assert.equal(remainingCount, relationships.length - 1, "Should delete exactly one relationship");
    });

    it("deleteInstances with different relationship classes", async () => {
      const relationships = setupRelationships(500, true);

      // Verify relationships were created across different classes
      assert.isTrue(await getRelationshipCount(testImodel, "BisCore.ElementGroupsMembers") >= Math.floor(relationships.length / 3));
      assert.isTrue(await getRelationshipCount(testImodel, "BisCore.ElementDrivesElement") >= Math.floor(relationships.length / 3));
      assert.isTrue(await getRelationshipCount(testImodel, "BisCore.ElementRefersToDocuments") >= Math.floor(relationships.length / 3));

      // Test deleteInstances with mixed relationship classes
      withEditTxn(testImodel, (txn) => {
        txn.deleteRelationships(relationships);
      });

      // Verify all relationships were deleted regardless of their class
      assert.equal(0, await getRelationshipCount(testImodel, "BisCore.ElementGroupsMembers"), "All ElementGroupsMembers relationships should be deleted");
      assert.equal(0, await getRelationshipCount(testImodel, "BisCore.ElementDrivesElement"), "All ElementDrivesElement relationships should be deleted");
      assert.equal(0, await getRelationshipCount(testImodel, "BisCore.ElementRefersToDocuments"), "All ElementRefersToDocuments relationships should be deleted");
    });

    it("deleteInstances for subset including duplicate entries", async () => {
      const relationships = setupRelationships(1000, true);

      // Verify relationships exist before deletion
      assert.isTrue(await getRelationshipCount(testImodel, "BisCore.ElementGroupsMembers") >= Math.floor(relationships.length / 3));
      assert.isTrue(await getRelationshipCount(testImodel, "BisCore.ElementDrivesElement") >= Math.floor(relationships.length / 3));
      assert.isTrue(await getRelationshipCount(testImodel, "BisCore.ElementRefersToDocuments") >= Math.floor(relationships.length / 3));

      // Select a deterministic, unique subset (every 4th relationship => 250 unique entries)
      // so the test is stable and reproducible.
      const relationshipsToDelete: RelationshipProps[] = [];
      for (let i = 0; i < relationships.length; i += 4) {
        relationshipsToDelete.push(relationships[i]);
      }
      assert.equal(relationshipsToDelete.length, 250);

      // Intentionally pass one relationship twice in the same call. deleteRelationships must
      // tolerate duplicate IDs in a single batch (deleting an already-deleted relationship is a no-op),
      // which exercises the batch/native boundary that the previous with-replacement sampling covered.
      const duplicated = relationshipsToDelete[0];
      relationshipsToDelete.push(duplicated);

      withEditTxn(testImodel, (txn) => {
        txn.deleteRelationships(relationshipsToDelete);
      });

      // Verify all relationships were deleted (dedupe so the duplicated entry is only checked once)
      const uniqueDeleted = relationshipsToDelete.filter((rel, index) => relationshipsToDelete.indexOf(rel) === index);
      for (const relClass of uniqueDeleted) {
        const reader = testImodel.createQueryReader(`SELECT ECInstanceId FROM ${relClass.classFullName} WHERE SourceECInstanceId=? AND TargetECInstanceId=?`, new QueryBinder().bindId(1, relClass.sourceId).bindId(2, relClass.targetId));
        assert.isFalse(await reader.step(), `Relationship ${relClass.id} should be deleted`); // No row should be returned
      }
    });
  });
});
