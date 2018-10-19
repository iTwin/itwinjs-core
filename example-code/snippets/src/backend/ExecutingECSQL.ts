/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { IModelDb, ECSqlStatement, ECSqlValue } from "@bentley/imodeljs-backend";
import { NavigationValue } from "@bentley/imodeljs-common";
import { DbResult, Id64 } from "@bentley/bentleyjs-core";

// tslint:disable:no-console

function executeECSql_Binding(iModel: IModelDb) {
  // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_ByParameter_Positional
  iModel.withPreparedStatement("SELECT ECInstanceId,ECClassId,Parent,LastMod FROM bis.Element WHERE CodeValue=? AND LastMod>=?", (stmt: ECSqlStatement) => {
    stmt.bindString(1, "MyCode");
    stmt.bindDateTime(2, "2018-01-01T12:00:00");

    while (stmt.step() === DbResult.BE_SQLITE_ROW) {
      // do something with the query result
    }
  });
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_ByParameter_Named
  iModel.withPreparedStatement("SELECT ECInstanceId,ECClassId,Parent,LastMod FROM bis.Element WHERE CodeValue=:code AND LastMod>=:lastmod", (stmt: ECSqlStatement) => {
    stmt.bindString("code", "MyCode");
    stmt.bindDateTime("lastmod", "2018-01-01T12:00:00Z");

    while (stmt.step() === DbResult.BE_SQLITE_ROW) {
      // do something with the query result
    }
  });
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ ExecuteECSql_BindValues_Positional
  iModel.withPreparedStatement("SELECT ECInstanceId,ECClassId,Parent,LastMod FROM bis.Element WHERE CodeValue=? AND LastMod>=?",
    (stmt: ECSqlStatement) => {
      stmt.bindValues(["MyCode", "2018-01-01T12:00:00Z"]);

      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        // do something with the query result
      }
    });
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ ExecuteECSql_BindValues_Named
  iModel.withPreparedStatement("SELECT ECInstanceId,ECClassId,Parent,LastMod FROM bis.Element WHERE CodeValue=:code AND LastMod>=:lastmod",
    (stmt: ECSqlStatement) => {
      stmt.bindValues({ code: "MyCode", lastmod: "2018-01-01T12:00:00Z" });

      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        // do something with the query result
      }
    });
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_Navigation_ByParameter
  iModel.withPreparedStatement("SELECT ECInstanceId FROM bis.Element WHERE Parent=?", (stmt: ECSqlStatement) => {
    stmt.bindNavigation(1, { id: "0x132" });
    // ...
  });
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ ExecuteECSql_BindValues_Navigation
  iModel.withPreparedStatement("SELECT ECInstanceId FROM bis.Element WHERE Parent=?", (stmt: ECSqlStatement) => {
    stmt.bindValues([{ id: "0x132" }]);
    // ...
  });
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_NavigationId_ByParameter
  iModel.withPreparedStatement("SELECT ECInstanceId FROM bis.Element WHERE Parent.Id=?", (stmt: ECSqlStatement) => {
    stmt.bindId(1, "0x132");
    // ...
  });
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ ExecuteECSql_BindValues_NavigationId
  iModel.withPreparedStatement("SELECT ECInstanceId FROM bis.Element WHERE Parent.Id=?", (stmt: ECSqlStatement) => {
    stmt.bindValues(["0x132"]);
    // ...
  });
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_Struct_ByParameter
  iModel.withPreparedStatement("SELECT Name FROM myschema.Company WHERE Location=?", (stmt: ECSqlStatement) => {
    stmt.bindStruct(1, { street: "7123 Main Street", zip: 30211 });
    // ...
  });
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ ExecuteECSql_BindValues_Struct
  iModel.withPreparedStatement("SELECT Name FROM myschema.Company WHERE Location=?", (stmt: ECSqlStatement) => {
    stmt.bindValues([{ street: "7123 Main Street", zip: 30211 }]);
    // ...
  });
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_StructMembers_ByParameter
  iModel.withPreparedStatement("SELECT Name FROM myschema.Company WHERE Location.Street=? AND Location.Zip=?", (stmt: ECSqlStatement) => {
    stmt.bindString(1, "7123 Main Street");
    stmt.bindInteger(2, 32443);
    // ...
  });
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ ExecuteECSql_BindValues_StructMembers
  iModel.withPreparedStatement("SELECT Name FROM myschema.Company WHERE Location.Street=? AND Location.Zip=?", (stmt: ECSqlStatement) => {
    stmt.bindValues(["7123 Main Street", 32443]);
    // ...
  });
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_Array_ByParameter
  iModel.withPreparedStatement("SELECT Name FROM myschema.Company WHERE PhoneNumbers=?", (stmt: ECSqlStatement) => {
    stmt.bindArray(1, ["+16134584201", "+16134584202", "+16134584222"]);
    // ...
  });
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ ExecuteECSql_BindValues_Array
  iModel.withPreparedStatement("SELECT Name FROM myschema.Company WHERE PhoneNumbers=?", (stmt: ECSqlStatement) => {
    stmt.bindValues([["+16134584201", "+16134584202", "+16134584222"]]);
    // ...
  });
  // __PUBLISH_EXTRACT_END__
}

function executeECSql_QueryResult(iModel: IModelDb) {
  // __PUBLISH_EXTRACT_START__ ExecuteECSql_GetRow_IllustrateRowFormat
  iModel.withPreparedStatement("SELECT ECInstanceId,ECClassId,Parent,LastMod FROM bis.Element WHERE Model.Id=?", (stmt: ECSqlStatement) => {

    stmt.bindId(1, "0x113");

    while (stmt.step() === DbResult.BE_SQLITE_ROW) {
      const row: any = stmt.getRow();
      console.log(JSON.stringify(row));
    }
  });
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ ExecuteECSql_GetRow
  iModel.withPreparedStatement("SELECT ECInstanceId,ECClassId,Parent,LastMod FROM bis.Element WHERE Model.Id=?", (stmt: ECSqlStatement) => {

    stmt.bindId(1, "0x113");

    console.log("ECInstanceId | ClassName | Parent Id | Parent RelClassName | LastMod");

    while (stmt.step() === DbResult.BE_SQLITE_ROW) {
      const row: any = stmt.getRow();
      const id: string = row.id;
      const className: string = row.className;
      const parent: NavigationValue = row.parent;
      const lastMod: string = row.lastMod;

      console.log(id + "|" + className + "|" + parent.id + "|" + parent.relClassName + "|" + lastMod);
    }
  });
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ ExecuteECSql_GetValue
  iModel.withPreparedStatement("SELECT ECInstanceId,ECClassId,Parent,LastMod FROM bis.Element WHERE Model.Id=?", (stmt: ECSqlStatement) => {
    stmt.bindId(1, new Id64("0x113"));

    console.log("ECInstanceId | ClassName | Parent Id | Parent RelClassName | LastMod");

    while (stmt.step() === DbResult.BE_SQLITE_ROW) {
      const idValue: ECSqlValue = stmt.getValue(0);
      const classIdValue: ECSqlValue = stmt.getValue(1);
      const parentValue: ECSqlValue = stmt.getValue(2);
      const lastModValue: ECSqlValue = stmt.getValue(3);

      const id: string = idValue.getId();
      const className: string = classIdValue.getClassNameForClassId();
      const parent: NavigationValue = parentValue.getNavigation();
      const lastMod: string = lastModValue.getDateTime();

      console.log(id + "|" + className + "|" + parent.id + "|" + parent.relClassName + "|" + lastMod);
    }
  });
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ ExecuteECSql_GetValue_PreserveClassIds
  iModel.withPreparedStatement("SELECT ECClassId,Parent.RelECClassId FROM bis.Element WHERE Model.Id=?", (stmt: ECSqlStatement) => {
    stmt.bindId(1, "0x113");

    console.log("ECClassId | Parent RelECClassId");
    while (stmt.step() === DbResult.BE_SQLITE_ROW) {
      const classIdValue: ECSqlValue = stmt.getValue(0);
      const parentRelClassIdValue: ECSqlValue = stmt.getValue(1);

      const classId: string = classIdValue.getId();
      const parentRelClassId: string = parentRelClassIdValue.getId();

      console.log(classId + "|" + parentRelClassId);
    }
  });
  // __PUBLISH_EXTRACT_END__
}

const dummyIModel = IModelDb.openStandalone("");
executeECSql_Binding(dummyIModel);
executeECSql_QueryResult(dummyIModel);
