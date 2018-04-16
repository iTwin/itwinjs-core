/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelDb, ECSqlStatement } from "@bentley/imodeljs-backend";
import { ECSqlStringType } from "@bentley/imodeljs-common";
import { DbResult, Id64 } from "@bentley/bentleyjs-core";

// tslint:disable:no-console

// __PUBLISH_EXTRACT_START__ IModelDb.executeQuery_positionalParameters
function IModelDb_ExecuteQuery_PositionalParameters(iModel: IModelDb) {
  const rows = iModel.executeQuery("SELECT ECInstanceId,ECClassId,Parent,LastMod FROM bis.Element WHERE Model.Id=? AND LastMod>=?",
  [new Id64("0x312"), {type: ECSqlStringType.DateTime, value: "2018-01-01T12:00:00"}]);

  for (const row of rows) {
    console.log(row);
  }
}

// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ IModelDb.executeQuery_namedParameters
function IModelDb_ExecuteQuery_NamedParameters(iModel: IModelDb) {
  const rows = iModel.executeQuery("SELECT ECInstanceId,ECClassId,Parent,LastMod FROM bis.Element WHERE Model=:model AND LastMod>=:lastmod",
  {model: new Id64("0x312"), lastmod: {type: ECSqlStringType.DateTime, value: "2018-01-01T12:00:00"}});

  for (const row of rows) {
    console.log(row);
  }
}

// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ IModelDb.withPreparedStatement_bindxx
function IModelDb_WithPreparedStatement_BindXX(iModel: IModelDb) {
  iModel.withPreparedStatement("SELECT ECInstanceId,ECClassId,Parent,LastMod FROM bis.Element WHERE Model=? AND LastMod>=?",
    (stmt: ECSqlStatement) => {
      stmt.bindId(1, new Id64("0x312"));
      stmt.bindDateTime(2, "2018-01-01T12:00:00");

      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        const row = stmt.getRow();
        console.log(row);
      }
  });
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ IModelDb.withPreparedStatement_bindValues
function IModelDb_WithPreparedStatement_BindValues(iModel: IModelDb) {
  iModel.withPreparedStatement("SELECT ECInstanceId,ECClassId,Parent,LastMod FROM bis.Element WHERE Model=? AND LastMod>=?",
    (stmt: ECSqlStatement) => {
      stmt.bindValues([new Id64("0x312"), {type: ECSqlStringType.DateTime, value: "2018-01-01T12:00:00"}]);

      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        const row = stmt.getRow();
        console.log(row);
      }
  });
}
// __PUBLISH_EXTRACT_END__

const dummyIModel = IModelDb.openStandalone("");
IModelDb_ExecuteQuery_PositionalParameters(dummyIModel);
IModelDb_ExecuteQuery_NamedParameters(dummyIModel);
IModelDb_WithPreparedStatement_BindXX(dummyIModel);
IModelDb_WithPreparedStatement_BindXX(dummyIModel);
IModelDb_WithPreparedStatement_BindValues(dummyIModel);
