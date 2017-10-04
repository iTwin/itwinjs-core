/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Element } from "../Element";
import { IModelDb } from "../backend/IModelDb";
import { SpatialCategory } from "../Category";
// import { Model } from "../Model";
import { DbResult } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { IModelError } from "../IModelError";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { ECSqlStatement } from "../backend/ECSqlStatement";
import * as fs from "fs-extra";

declare const __dirname: string;

export class IModelTestUtils {
  public static user = {
    email: "bistroDEV_pmadm1@mailinator.com",
    password: "pmadm1",
  };

  private static getStat(name: string) {
    let stat: fs.Stats | undefined;
    try {
      stat = fs.statSync(name);
    } catch (err) { stat = undefined; }
    return stat;
  }

  public static async openIModel(filename: string): Promise<IModelDb> {
    const destPath = __dirname + "/output";
    if (!fs.existsSync(destPath))
      fs.mkdirSync(destPath);

    const srcName = __dirname + "/assets/" + filename;
    const dbName = destPath + "/" + filename;
    const srcStat = IModelTestUtils.getStat(srcName);
    const destStat = IModelTestUtils.getStat(dbName);
    if (!srcStat || !destStat || srcStat.mtime.getTime() !== destStat.mtime.getTime()) {
      fs.copySync(srcName, dbName, { preserveTimestamps: true });
    }

    const iModel: IModelDb = await IModelDb.openStandalone(dbName); // could throw Error
    assert.exists(iModel);
    return iModel!;
  }

  public static closeIModel(iModel: IModelDb) {
    iModel.closeStandalone();
  }

  // TODO: This neeeds a home
  public static queryCodeSpecId(imodel: IModelDb, name: string): Id64 | undefined {
    // TODO: Use a statement cache
    let id: Id64 | undefined;
    imodel.withPreparedECSqlStatement("SELECT ecinstanceid FROM BisCore.CodeSpec WHERE Name=?", (stmt: ECSqlStatement) => {
      stmt.bindValues([name]);
      if (DbResult.BE_SQLITE_ROW !== stmt.step()) {
        return;
      }
      id = new Id64(stmt.getValues().ecinstanceid);
    });
    return id;
}

  // TODO: This needs a home
  public static queryElementIdByCode(imodel: IModelDb, codeSpec: Id64, scopeElementId: Id64, value: string): Id64 | undefined {
    // TODO: Use a statement cache
    const stmt = imodel.getPreparedECSqlStatement("SELECT ecinstanceid FROM " + Element.sqlName + " WHERE CodeSpecId=? AND CodeScopeId=? AND CodeValue=? LIMIT 1");
    stmt.bindValues([codeSpec, scopeElementId, value]);
    if (DbResult.BE_SQLITE_ROW !== stmt.step()) {
      return undefined;
    }
    const id = new Id64(stmt.getValues().ecinstanceid);
    imodel.releasePreparedECSqlStatement(stmt);
    return id;
  }

  // TODO: This needs a home
  public static getSpatiallCategoryIdByName(imodel: IModelDb, catname: string): Id64 {
    // TODO: Use a statement cache
    const stmt = imodel.getPreparedECSqlStatement("SELECT EcInstanceId as elementId FROM " + SpatialCategory.sqlName + " WHERE codevalue = ?");
    stmt.bindValues([catname]);
    if (DbResult.BE_SQLITE_ROW !== stmt.step()) {
      throw new IModelError(DbResult.BE_SQLITE_NOTFOUND);
    }
    const categoryId: string = stmt.getValues().elementId;
    imodel.releasePreparedECSqlStatement(stmt);

    const id = new Id64(categoryId);
    if (!id.isValid())
      throw new IModelError(DbResult.BE_SQLITE_NOTFOUND);

    return id;
  }

}
