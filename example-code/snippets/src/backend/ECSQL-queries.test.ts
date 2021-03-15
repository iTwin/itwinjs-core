/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { DbResult, Id64Set, Id64String } from "@bentley/bentleyjs-core";
import { ECSqlStatement, Element, IModelDb, PhysicalPartition, SnapshotDb, Subject } from "@bentley/imodeljs-backend";
import { IModelTestUtils } from "./IModelTestUtils";

/** Useful ECSQL queries organized as tests to make sure that they build and run successfully. */
describe("Useful ECSQL queries", () => {
  let iModel: SnapshotDb;

  before(async () => {
    iModel = IModelTestUtils.openSnapshotFromSeed("test.bim", { copyFilename: "ecsql-queries.bim" });
  });

  after(() => {
    iModel.close();
  });

  it("should select by code value", () => {
    // __PUBLISH_EXTRACT_START__ ECSQL-backend-queries.select-element-by-code-value
    // Suppose an iModel has the following breakdown structure:
    // * The root subject
    // * * Subject with CodeValue="Subject1"
    // * * * PhysicalPartition with CodeValue="Physical"

    // Suppose you want to look up the PhysicalPartition whose code value is "Physical".
    // You could write the following query to find it. This query specifies that the
    // element you want is a PhysicalPartition, it has a code value of "Physical",
    // and it is a child of a Subject named "Subject1".
    const partitionIds: Id64Set = iModel.withPreparedStatement(`
      select
        partition.ecinstanceid
      from
        ${PhysicalPartition.classFullName} as partition,
        (select ecinstanceid from ${Subject.classFullName} where CodeValue=:parentName) as parent
      where
        partition.codevalue=:partitionName and partition.parent.id = parent.ecinstanceid;
    `, (stmt: ECSqlStatement) => {
      stmt.bindValue("parentName", "Subject1");
      stmt.bindValue("partitionName", "Physical");
      const ids: Id64Set = new Set<Id64String>();
      while (stmt.step() === DbResult.BE_SQLITE_ROW)
        ids.add(stmt.getValue(0).getId());
      return ids;
    });

    assert.isNotEmpty(partitionIds);
    assert.equal(partitionIds.size, 1);
    for (const eidStr of partitionIds) {
      assert.equal(iModel.elements.getElement(eidStr).code.value, "Physical");
    }
    // __PUBLISH_EXTRACT_END__
  });

  it("should select by code value using queryEntityIds", () => {
    // __PUBLISH_EXTRACT_START__ ECSQL-backend-queries.select-element-by-code-value-using-queryEntityIds
    // If you are sure that the name of the PhysicalPartition is unique within the
    // iModel or if you have some way of filtering results, you could do a direct query
    // for just its code value using the IModelDb.queryEntityIds convenience method.
    for (const eidStr of iModel.queryEntityIds({ from: PhysicalPartition.classFullName, where: "CodeValue=:cv", bindings: { cv: "Physical" } })) {
      assert.equal(iModel.elements.getElement(eidStr).code.value, "Physical");
    }
    // __PUBLISH_EXTRACT_END__
  });

  it("should select all elements in a model", () => {
    // __PUBLISH_EXTRACT_START__ ECSQL-backend-queries.select-elements-in-model
    const modelId: Id64String = IModelDb.repositoryModelId;
    iModel.withPreparedStatement(`SELECT ECInstanceId AS id FROM ${Element.classFullName} WHERE Model.Id=:modelId`, (statement: ECSqlStatement) => {
      statement.bindId("modelId", modelId);
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        // do something with each row
      }
    });
    // __PUBLISH_EXTRACT_END__
  });

  it("should select all top-level elements in a model", () => {
    // __PUBLISH_EXTRACT_START__ ECSQL-backend-queries.select-top-level-elements-in-model
    const modelId: Id64String = IModelDb.repositoryModelId;
    iModel.withPreparedStatement(`SELECT ECInstanceId AS id FROM ${Element.classFullName} WHERE Model.Id=:modelId AND Parent.Id IS NULL`, (statement: ECSqlStatement) => {
      statement.bindId("modelId", modelId);
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        // do something with each row
      }
    });
    // __PUBLISH_EXTRACT_END__
  });

  it("should select all child elements of the specified element", () => {
    // __PUBLISH_EXTRACT_START__ ECSQL-backend-queries.select-child-elements
    const parentId: Id64String = IModelDb.rootSubjectId;
    iModel.withPreparedStatement(`SELECT ECInstanceId AS id FROM ${Element.classFullName} WHERE Parent.Id=:parentId`, (statement: ECSqlStatement) => {
      statement.bindId("parentId", parentId);
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        // do something with each row
      }
    });
    // __PUBLISH_EXTRACT_END__
  });

});
