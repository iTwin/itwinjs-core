"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
const imodeljs_backend_1 = require("@bentley/imodeljs-backend");
const imodeljs_common_1 = require("@bentley/imodeljs-common");
const bentleyjs_core_1 = require("@bentley/bentleyjs-core");
// tslint:disable:no-console
function executeECSql_Binding(iModel) {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_ByParameter_Positional
    iModel.withPreparedStatement("SELECT ECInstanceId,ECClassId,Parent,LastMod FROM bis.Element WHERE CodeValue=? AND LastMod>=?", (stmt) => {
        stmt.bindString(1, "MyCode");
        stmt.bindDateTime(2, "2018-01-01T12:00:00");
        while (stmt.step() === 100 /* BE_SQLITE_ROW */) {
            const row = stmt.getRow();
            console.log(row);
        }
    });
    // __PUBLISH_EXTRACT_END__
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_ByParameter_Named
    iModel.withPreparedStatement("SELECT ECInstanceId,ECClassId,Parent,LastMod FROM bis.Element WHERE CodeValue=:code AND LastMod>=:lastmod", (stmt) => {
        stmt.bindString("code", "MyCode");
        stmt.bindDateTime("lastmod", "2018-01-01T12:00:00");
        while (stmt.step() === 100 /* BE_SQLITE_ROW */) {
            const row = stmt.getRow();
            console.log(row);
        }
    });
    // __PUBLISH_EXTRACT_END__
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_BindValues_Positional
    iModel.withPreparedStatement("SELECT ECInstanceId,ECClassId,Parent,LastMod FROM bis.Element WHERE CodeValue=? AND LastMod>=?", (stmt) => {
        stmt.bindValues(["MyCode", { type: imodeljs_common_1.ECSqlStringType.DateTime, value: "2018-01-01T12:00:00" }]);
        while (stmt.step() === 100 /* BE_SQLITE_ROW */) {
            const row = stmt.getRow();
            console.log(row);
        }
    });
    // __PUBLISH_EXTRACT_END__
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_BindValues_Named
    iModel.withPreparedStatement("SELECT ECInstanceId,ECClassId,Parent,LastMod FROM bis.Element WHERE CodeValue=:code AND LastMod>=:lastmod", (stmt) => {
        stmt.bindValues({ code: "MyCode", lastmod: { type: imodeljs_common_1.ECSqlStringType.DateTime, value: "2018-01-01T12:00:00" } });
        while (stmt.step() === 100 /* BE_SQLITE_ROW */) {
            const row = stmt.getRow();
            console.log(row);
        }
    });
    // __PUBLISH_EXTRACT_END__
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_Navigation_ByParameter
    iModel.withPreparedStatement("SELECT ECInstanceId FROM bis.Element WHERE Parent=?", (stmt) => {
        stmt.bindNavigation(1, { id: new bentleyjs_core_1.Id64("0x132") });
        // ...
    });
    // __PUBLISH_EXTRACT_END__
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_BindValues_Navigation
    iModel.withPreparedStatement("SELECT ECInstanceId FROM bis.Element WHERE Parent=?", (stmt) => {
        stmt.bindValues([{ id: new bentleyjs_core_1.Id64("0x132") }]);
        // ...
    });
    // __PUBLISH_EXTRACT_END__
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_NavigationId_ByParameter
    iModel.withPreparedStatement("SELECT ECInstanceId FROM bis.Element WHERE Parent.Id=?", (stmt) => {
        stmt.bindId(1, new bentleyjs_core_1.Id64("0x132"));
        // ...
    });
    // __PUBLISH_EXTRACT_END__
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_BindValues_NavigationId
    iModel.withPreparedStatement("SELECT ECInstanceId FROM bis.Element WHERE Parent.Id=?", (stmt) => {
        stmt.bindValues([new bentleyjs_core_1.Id64("0x132")]);
        // ...
    });
    // __PUBLISH_EXTRACT_END__
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_Struct_ByParameter
    iModel.withPreparedStatement("SELECT Name FROM myschema.Company WHERE Location=?", (stmt) => {
        stmt.bindStruct(1, { street: "7123 Main Street", zip: 30211 });
        // ...
    });
    // __PUBLISH_EXTRACT_END__
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_BindValues_Struct
    iModel.withPreparedStatement("SELECT Name FROM myschema.Company WHERE Location=?", (stmt) => {
        stmt.bindValues([{ street: "7123 Main Street", zip: 30211 }]);
        // ...
    });
    // __PUBLISH_EXTRACT_END__
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_StructMembers_ByParameter
    iModel.withPreparedStatement("SELECT Name FROM myschema.Company WHERE Location.Street=? AND Location.Zip=?", (stmt) => {
        stmt.bindString(1, "7123 Main Street");
        stmt.bindInteger(2, 32443);
        // ...
    });
    // __PUBLISH_EXTRACT_END__
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_BindValues_StructMembers
    iModel.withPreparedStatement("SELECT Name FROM myschema.Company WHERE Location.Street=? AND Location.Zip=?", (stmt) => {
        stmt.bindValues(["7123 Main Street", 32443]);
        // ...
    });
    // __PUBLISH_EXTRACT_END__
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_Array_ByParameter
    iModel.withPreparedStatement("SELECT Name FROM myschema.Company WHERE PhoneNumbers=?", (stmt) => {
        stmt.bindArray(1, ["+16134584201", "+16134584202", "+16134584222"]);
        // ...
    });
    // __PUBLISH_EXTRACT_END__
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_BindValues_Array
    iModel.withPreparedStatement("SELECT Name FROM myschema.Company WHERE PhoneNumbers=?", (stmt) => {
        stmt.bindValues([["+16134584201", "+16134584202", "+16134584222"]]);
        // ...
    });
    // __PUBLISH_EXTRACT_END__
}
function executeECSql_QueryResult(iModel) {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_GetRow_IllustrateRowFormat
    iModel.withPreparedStatement("SELECT ECInstanceId,ECClassId,Parent,LastMod FROM bis.Element WHERE Model.Id=?", (stmt) => {
        stmt.bindId(1, new bentleyjs_core_1.Id64("0x113"));
        while (stmt.step() === 100 /* BE_SQLITE_ROW */) {
            const row = stmt.getRow();
            console.log(JSON.stringify(row));
        }
    });
    // __PUBLISH_EXTRACT_END__
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_GetRow
    iModel.withPreparedStatement("SELECT ECInstanceId,ECClassId,Parent,LastMod FROM bis.Element WHERE Model.Id=?", (stmt) => {
        stmt.bindId(1, new bentleyjs_core_1.Id64("0x113"));
        console.log("ECInstanceId | ClassName | Parent Id | Parent RelClassName | LastMod");
        while (stmt.step() === 100 /* BE_SQLITE_ROW */) {
            const row = stmt.getRow();
            const id = row.id;
            const className = row.className;
            const parent = row.parent;
            const lastMod = row.lastMod;
            console.log(id + "|" + className + "|" + parent.id + "|" + parent.relClassName + "|" + lastMod);
        }
    });
    // __PUBLISH_EXTRACT_END__
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_GetValue
    iModel.withPreparedStatement("SELECT ECInstanceId,ECClassId,Parent,LastMod FROM bis.Element WHERE Model.Id=?", (stmt) => {
        stmt.bindId(1, new bentleyjs_core_1.Id64("0x113"));
        console.log("ECInstanceId | ClassName | Parent Id | Parent RelClassName | LastMod");
        while (stmt.step() === 100 /* BE_SQLITE_ROW */) {
            const idValue = stmt.getValue(0);
            const classIdValue = stmt.getValue(1);
            const parentValue = stmt.getValue(2);
            const lastModValue = stmt.getValue(3);
            const id = idValue.getId();
            const className = classIdValue.getClassNameForClassId();
            const parent = parentValue.getNavigation();
            const lastMod = lastModValue.getDateTime();
            console.log(id + "|" + className + "|" + parent.id + "|" + parent.relClassName + "|" + lastMod);
        }
    });
    // __PUBLISH_EXTRACT_END__
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_GetValue_PreserveClassIds
    iModel.withPreparedStatement("SELECT ECClassId,Parent.RelECClassId FROM bis.Element WHERE Model.Id=?", (stmt) => {
        stmt.bindId(1, new bentleyjs_core_1.Id64("0x113"));
        console.log("ECClassId | Parent RelECClassId");
        while (stmt.step() === 100 /* BE_SQLITE_ROW */) {
            const classIdValue = stmt.getValue(0);
            const parentRelClassIdValue = stmt.getValue(1);
            const classId = classIdValue.getId();
            const parentRelClassId = parentRelClassIdValue.getId();
            console.log(classId + "|" + parentRelClassId);
        }
    });
    // __PUBLISH_EXTRACT_END__
}
const dummyIModel = imodeljs_backend_1.IModelDb.openStandalone("");
executeECSql_Binding(dummyIModel);
executeECSql_QueryResult(dummyIModel);
//# sourceMappingURL=ExecutingECSQL.js.map