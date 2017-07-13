/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { ECSqlStatement } from "../IModelServiceTier";
import { BeSQLite } from "../Constants";
import { IModel } from "../IModel";

declare const __dirname: string;

class ECSqlStatementTestUtils {
  public static async openIModel(filename: string, expectSuccess: boolean): Promise<IModel> {
    const imodel = new IModel();
    const res: BeSQLite.DbResult = await imodel.openDgnDb(__dirname + "/assets/" + filename); // throws an exception if open fails
    assert.equal(expectSuccess, (BeSQLite.DbResult.BE_SQLITE_OK === res));
    return imodel;
  }

  public static async getStatement(imodel: IModel, ecsql: string, expectSuccess: boolean): Promise<ECSqlStatement> {
    const stmt: ECSqlStatement = await imodel.getDgnDb().getPreparedECSqlSelectStatement(ecsql);
    assert.equal(expectSuccess, (null != stmt));
    return stmt;
  }
}

describe("ECSqlStatement", () => {

  it("should prepare a SELECT ALL statement", async () => {
    const imodel: IModel = await ECSqlStatementTestUtils.openIModel("test.bim", true);
    ECSqlStatementTestUtils.getStatement (imodel, "select * from BIS.Element", true);
  });

  it("should not prepare an UPDATE statement", async () => {
    const imodel: IModel = await ECSqlStatementTestUtils.openIModel("test.bim", true);
    ECSqlStatementTestUtils.getStatement (imodel, "update BIS.Element set CodeValue='a'", false);
  });

  it("should produce a single row from SELECT ALL using step_once", async () => {
    const imodel: IModel = await ECSqlStatementTestUtils.openIModel("test.bim", true);
    const stmt = await ECSqlStatementTestUtils.getStatement (imodel, "select * from BIS.Element", true);
    const rowdata = await stmt.step_once();
    assert.isNotNull(rowdata);
    const obj: any = JSON.parse(rowdata);
    assert.typeOf(obj, "object");
    assert.notEqual(obj.ecinstanceid, "");
  });

  it("should produce an array of rows from SELECT ALL using step_all", async () => {
    const imodel: IModel = await ECSqlStatementTestUtils.openIModel("test.bim", true);
    const stmt = await ECSqlStatementTestUtils.getStatement (imodel, "select * from BIS.Element", true);
    const allrowsdata = await stmt.step_all();
    assert.isNotNull(allrowsdata);
    const rows: any = JSON.parse(allrowsdata);
    // assert.typeOf(rows, "[object Array]");
    assert.isTrue(rows instanceof Array);
    assert.notEqual(rows.length, 0);
    assert.notEqual(rows[0].ecinstanceid, "");
  });

});
