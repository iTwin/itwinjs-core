/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { ECSqlStatement } from "@bentley/imodeljs-dgnplatform/lib/DgnDb";
import { IModel } from "../IModel";
import { IModelTestUtils } from "./IModelTestUtils";

class ECSqlStatementTestUtils {

  public static async getStatement(imodel: IModel, ecsql: string, expectSuccess: boolean): Promise<ECSqlStatement> {
    const stmt: ECSqlStatement = await imodel.getDgnDb().getPreparedECSqlSelectStatement(ecsql);
    assert.equal(expectSuccess, (null != stmt));
    return stmt;
  }
}

describe("ECSqlStatement", () => {

  it("should prepare a SELECT ALL statement", async () => {
    const imodel: IModel = await IModelTestUtils.openIModel("test.bim", true);
    ECSqlStatementTestUtils.getStatement (imodel, "select * from BIS.Element", true);
  });

  it("should not prepare an UPDATE statement", async () => {
    try {
    const imodel: IModel = await IModelTestUtils.openIModel("test.bim", true, true);
    await ECSqlStatementTestUtils.getStatement (imodel, "update BIS.Element set CodeValue='a'", false);
    assert.fail(true, false, "An UPDATE statement should not prepare.");
    } catch (reason) {
      // this is what I expected
    }
  });

  it("should produce a single row from SELECT ALL using step_once", async () => {
    const imodel: IModel = await IModelTestUtils.openIModel("test.bim", true);
    const stmt = await ECSqlStatementTestUtils.getStatement (imodel, "select * from BIS.Element", true);
    const rowdata = await stmt.step_once();
    assert.isNotNull(rowdata);
    const obj: any = JSON.parse(rowdata);
    assert.isObject(obj);
    assert.notEqual(obj.ecinstanceid, "");
  });

  it("should produce an array of rows from SELECT ALL using step_all", async () => {
    const imodel: IModel = await IModelTestUtils.openIModel("test.bim", true);
    const stmt = await ECSqlStatementTestUtils.getStatement (imodel, "select * from BIS.Element", true);
    const allrowsdata = await stmt.step_all();
    assert.isNotNull(allrowsdata);
    const rows: any = JSON.parse(allrowsdata);
    assert.isArray(rows);
    assert.notEqual(rows.length, 0);
    assert.notEqual(rows[0].ecinstanceid, "");
  });
});
