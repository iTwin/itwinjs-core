/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { IModel, ECSqlStatement } from "../IModel";
import { IModelTestUtils } from "./IModelTestUtils";
import { Element } from "../Element";
import { Category } from "../Category";
import { BisCore } from "../BisCore";

// First, register any domains that will be used in the tests.
BisCore.registerSchema();

class ECSqlStatementTestUtils {

  public static async getStatement(imodel: IModel, ecsql: string, expectSuccess: boolean): Promise<ECSqlStatement> {
    const stmt: ECSqlStatement = await imodel.getPreparedECSqlSelectStatement(ecsql);
    assert.equal(expectSuccess, (null != stmt));
    return stmt;
  }
}

describe("ECSqlStatement", () => {

  it("should prepare a SELECT ALL statement", async () => {
    const imodel: IModel = await IModelTestUtils.openIModel("test.bim", true);
    ECSqlStatementTestUtils.getStatement (imodel, "SELECT * FROM " + Element.sqlName, true);
  });

  it("should not prepare an UPDATE statement", async () => {
    try {
    const imodel: IModel = await IModelTestUtils.openIModel("test.bim", true, true);
    await ECSqlStatementTestUtils.getStatement (imodel, "UPDATE " + Element.sqlName + " SET CodeValue='a'", false);
    assert.fail(true, false, "An UPDATE statement should not prepare.");
    } catch (reason) {
      // this is what I expected
    }
  });

  it("should produce a single row from SELECT ALL using step_once", async () => {
    const imodel: IModel = await IModelTestUtils.openIModel("test.bim", true);
    const stmt = await ECSqlStatementTestUtils.getStatement(imodel, "SELECT * FROM " + Element.sqlName, true);
    const rowdata = await stmt.step_once();
    assert.isNotNull(rowdata);
    const obj: any = JSON.parse(rowdata);
    assert.isObject(obj);
    assert.notEqual(obj.ecinstanceid, "");
  });

  it("should produce an array of rows from SELECT ALL using step_all", async () => {
    const imodel: IModel = await IModelTestUtils.openIModel("test.bim", true);
    const stmt = await ECSqlStatementTestUtils.getStatement(imodel, "SELECT * FROM " + Category.sqlName, true);
    const allrowsdata = await stmt.step_all();
    assert.isNotNull(allrowsdata);
    const rows: any = JSON.parse(allrowsdata);
    assert.isArray(rows);
    assert.notEqual(rows.length, 0);
    assert.notEqual(rows[0].ecinstanceid, "");
  });
});
