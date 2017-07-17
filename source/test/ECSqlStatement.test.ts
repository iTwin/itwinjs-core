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
    assert.isObject(obj);
    assert.notEqual(obj.ecinstanceid, "");
  });

  it("should produce an array of rows from SELECT ALL using step_all", async () => {
    const imodel: IModel = await ECSqlStatementTestUtils.openIModel("test.bim", true);
    const stmt = await ECSqlStatementTestUtils.getStatement (imodel, "select * from BIS.Element", true);
    const allrowsdata = await stmt.step_all();
    assert.isNotNull(allrowsdata);
    const rows: any = JSON.parse(allrowsdata);
    assert.isArray(rows);
    assert.notEqual(rows.length, 0);
    assert.notEqual(rows[0].ecinstanceid, "");
  });
});

describe("ECClassMetaData", () => {

  it("should get metadata for class", async () => {
    const imodel: IModel = await ECSqlStatementTestUtils.openIModel("test.bim", true);
    const metadatastr: string = await imodel.getDgnDb().getECClassMetaData("biscore", "Element");
    assert.isNotNull(metadatastr);
    assert.isString(metadatastr);
    assert.notEqual(metadatastr.length, 0);
    const obj: any = JSON.parse(metadatastr);
    assert.isNotNull(obj);
    assert.isString(obj.name);
    assert.equal(obj.name, "Element");
    assert.equal(obj.schema, "BisCore");
    assert.isArray(obj.baseClasses);
    assert.equal(obj.baseClasses.length, 0);
    assert.isArray(obj.customAttributes);
    let foundClassHasHandler = false;
    let foundClassHasCurrentTimeStampProperty = false;
    for (const ca of obj.customAttributes) {
      if (ca.ecclass.name === "ClassHasHandler")
        foundClassHasHandler = true;
      else if (ca.ecclass.name === "ClassHasCurrentTimeStampProperty")
        foundClassHasCurrentTimeStampProperty = true;
    }
    assert.isTrue(foundClassHasHandler);
    assert.isTrue(foundClassHasCurrentTimeStampProperty);
    assert.isDefined(obj.federationGuid);
    assert.isDefined(obj.federationGuid.primitiveECProperty);
    assert.equal(obj.federationGuid.primitiveECProperty.type, "binary");
    assert.equal(obj.federationGuid.primitiveECProperty.extendedType, "BeGuid");
  });

  it("should get metadata for CA class just as well (and we'll see an array-typed property)", async () => {
    const imodel: IModel = await ECSqlStatementTestUtils.openIModel("test.bim", true);
    const metadatastr: string = await imodel.getDgnDb().getECClassMetaData("biscore", "ClassHasHandler");
    assert.isNotNull(metadatastr);
    assert.isString(metadatastr);
    assert.notEqual(metadatastr.length, 0);
    const obj: any = JSON.parse(metadatastr);
    assert.isDefined(obj.restrictions);
    assert.isDefined(obj.restrictions.primitveArrayECProperty);
    assert.equal(obj.restrictions.primitveArrayECProperty.type, "string");
    assert.equal(obj.restrictions.primitveArrayECProperty.minOccurs, 0);
  });

  it("should get metadata for class, and we'll see a struct-typed property", async () => {
    const imodel: IModel = await ECSqlStatementTestUtils.openIModel("test.bim", true);
    const metadatastr: string = await imodel.getDgnDb().getECClassMetaData("biscore", "AnnotationTableCell");
    assert.isNotNull(metadatastr);
    assert.isString(metadatastr);
    assert.notEqual(metadatastr.length, 0);
    const obj: any = JSON.parse(metadatastr);
    assert.isDefined(obj.cellIndex);
    assert.isDefined(obj.cellIndex.structECProperty);
    assert.equal(obj.cellIndex.structECProperty.type, "AnnotationTableCellIndex");
  });
});
