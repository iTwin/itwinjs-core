/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { IModelDb, ECSqlStatement, PhysicalPartition, Subject } from "@bentley/imodeljs-backend";
import { IModelTestUtils } from "./IModelTestUtils";
import { Id64Set, DbResult } from "@bentley/bentleyjs-core";

/** Useful ECSQL queries organized as tests to make sure that they build and run successfully. */
describe("Useful ECSQL queries", () => {
  let iModel: IModelDb;

  before(async () => {
    iModel = IModelTestUtils.openIModel("test.bim");
  });

  after(() => {
    iModel.closeStandalone();
  });

  it("should select by code value", () => {
    // __PUBLISH_EXTRACT_START__ ECSQL-backend-queries.select-element-by-code-value

    // Suppose an iModel has the following breakdown structure:
    // * The root subject
    // * * Subject with CodeValue="Subject1"
    // * * * PhysicalPartition with CodeValue ="Physical"

    // Suppose you want to look up the PhysicalPartition whose code value is "Physical".
    // We could write the following query, to find this partition as a child of the
    // "Subject1" subject element. Note that you specify the BisCore class names
    // of both the parent subject and the child partition. That makes the query very
    // specific. It's unlikely that it will turn up any but the element that you want.
    const partitionIds: Id64Set = iModel.withPreparedStatement(`
      select
        partition.ecinstanceid
      from
        ${PhysicalPartition.classFullName} as partition,
        (select ecinstanceid from ${Subject.classFullName} where CodeValue=:parentName) as parent
      where
        partition.codevalue=:partitionName and partition.parent.id = parent.ecinstanceid;
    `, (stmt: ECSqlStatement) => {
        stmt.bindString("parentName", "Subject1");
        stmt.bindString("partitionName", "Physical");
        const ids: Id64Set = new Set<string>();
        while (stmt.step() === DbResult.BE_SQLITE_ROW)
          ids.add(stmt.getValue(0).getId());
        return ids;
      });

    assert.isNotEmpty(partitionIds);
    assert.equal(partitionIds.size, 1);
    for (const eidStr of partitionIds) {
      assert.equal(iModel.elements.getElement(eidStr).code.getValue(), "Physical");
    }
    // __PUBLISH_EXTRACT_END__
  });

  it("should select by code value using queryEntityIds", () => {
    // __PUBLISH_EXTRACT_START__ ECSQL-backend-queries.select-element-by-code-value-using-queryEntityIds

    // If you are sure that the name of the PhysicalPartition is unique within the
    // iModel or if you have some way of filtering results, you could do a direct query
    // for just its code value using the IModelDb.queryEntityIds convenience method.
    for (const eidStr of iModel.queryEntityIds({ from: PhysicalPartition.classFullName, where: "CodeValue='Physical'" })) {
      // Once you have the modeled element, you ask for its submodel -- that is that model.
      assert.equal(iModel.elements.getElement(eidStr).code.getValue(), "Physical");
    }
    // __PUBLISH_EXTRACT_END__
  });

});
