"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const imodeljs_common_1 = require("@bentley/imodeljs-common");
const bentleyjs_core_1 = require("@bentley/bentleyjs-core");
// tslint:disable:no-console
async function executeECSql_Binding(iModel) {
    {
        // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_Positional
        const rows = await iModel.executeQuery("SELECT ECInstanceId,ECClassId,Parent,LastMod FROM bis.Element WHERE CodeValue=? AND LastMod>=?", ["MyCode", { type: imodeljs_common_1.ECSqlStringType.DateTime, value: "2018-01-01T12:00:00" }]);
        // ...
        // __PUBLISH_EXTRACT_END__
        console.log(rows);
    }
    {
        // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_Named
        const rows = await iModel.executeQuery("SELECT ECInstanceId,ECClassId,Parent,LastMod FROM bis.Element WHERE CodeValue=:code AND LastMod>=:lastmod", { code: "MyCode", lastmod: { type: imodeljs_common_1.ECSqlStringType.DateTime, value: "2018-01-01T12:00:00" } });
        // ...
        // __PUBLISH_EXTRACT_END__
        console.log(rows);
    }
    {
        // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_Navigation
        const rows = await iModel.executeQuery("SELECT ECInstanceId FROM bis.Element WHERE Parent=?", [{ id: "0x132" }]);
        // ...
        // __PUBLISH_EXTRACT_END__
        console.log(rows);
    }
    {
        // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_NavigationId
        const rows = await iModel.executeQuery("SELECT ECInstanceId FROM bis.Element WHERE Parent.Id=?", [new bentleyjs_core_1.Id64("0x132")]);
        // ...
        // __PUBLISH_EXTRACT_END__
        console.log(rows);
    }
    {
        // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_Struct
        const rows = await iModel.executeQuery("SELECT Name FROM myschema.Company WHERE Location=?", [{ street: "7123 Main Street", zip: 30211 }]);
        // ...
        // __PUBLISH_EXTRACT_END__
        console.log(rows);
    }
    {
        // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_StructMembers
        const rows = await iModel.executeQuery("SELECT Name FROM myschema.Company WHERE Location.Street=? AND Location.Zip=?", ["7123 Main Street", 32443]);
        // ...
        // __PUBLISH_EXTRACT_END__
        console.log(rows);
    }
    {
        // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_Array
        const rows = await iModel.executeQuery("SELECT Name FROM myschema.Company WHERE PhoneNumbers=?", [["+16134584201", "+16134584202", "+16134584222"]]);
        // ...
        // __PUBLISH_EXTRACT_END__
        console.log(rows);
    }
}
async function executeECSql_QueryResult(iModel) {
    {
        // __PUBLISH_EXTRACT_START__ ExecuteECSql_IllustrateRowFormat
        const rows = await iModel.executeQuery("SELECT ECInstanceId,ECClassId,Parent,LastMod FROM bis.Element WHERE Model.Id=?", [new bentleyjs_core_1.Id64("0x113")]);
        for (const row of rows) {
            console.log(JSON.stringify(row));
        }
        // __PUBLISH_EXTRACT_END__
    }
    {
        // __PUBLISH_EXTRACT_START__ ExecuteECSql_WorkingWithRowFormat
        const rows = await iModel.executeQuery("SELECT ECInstanceId,ECClassId,Parent,LastMod FROM bis.Element WHERE Model.Id=?", [new bentleyjs_core_1.Id64("0x113")]);
        console.log("ECInstanceId | ClassName | Parent Id | Parent RelClassName | LastMod");
        for (const row of rows) {
            const id = row.id;
            const className = row.className;
            const parent = row.parent;
            const lastMod = row.lastMod;
            console.log(id + "|" + className + "|" + parent.id + "|" + parent.relClassName + "|" + lastMod);
        }
        // __PUBLISH_EXTRACT_END__
    }
}
const dummyIModel = {};
executeECSql_Binding(dummyIModel);
executeECSql_QueryResult(dummyIModel);
//# sourceMappingURL=ExecutingECSQL.js.map