/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { NavigationValue } from "@bentley/imodeljs-common";
import { Id64String } from "@bentley/bentleyjs-core";
// tslint:disable:no-console

async function executeECSql_SampleMethod(iModel: IModelConnection): Promise<void> {
  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_Positional
    for await (const row of iModel.query("SELECT ECInstanceId,ECClassId,Parent,LastMod FROM bis.Element WHERE CodeValue=? AND LastMod>=?",
      ["MyCode", "2018-01-01T12:00:00Z"])) {
      console.log(`${row.id}, ${row.className}, ${row.parent}, ${row.lastMod}`);
    }
    // __PUBLISH_EXTRACT_END__

  }

  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_Named
    for await (const row of iModel.query("SELECT ECInstanceId,ECClassId,Parent,LastMod FROM bis.Element WHERE CodeValue=:code AND LastMod>=:lastmod",
      { code: "MyCode", lastmod: "2018-01-01T12:00:00Z" })) {
      console.log(`${row.id}, ${row.className}, ${row.parent}, ${row.lastMod}`);
    }
    // __PUBLISH_EXTRACT_END__
  }

  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_Navigation
    for await (const row of iModel.query("SELECT ECInstanceId FROM bis.Element WHERE Parent=?", [{ id: "0x132" }])) {
      console.log(`${row.id}`);
    }
    // __PUBLISH_EXTRACT_END__
  }

  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_NavigationId
    for await (const row of iModel.query("SELECT ECInstanceId FROM bis.Element WHERE Parent.Id=?", ["0x132"])) {
      console.log(`${row.id}`);
    }
    // __PUBLISH_EXTRACT_END__
  }

  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_Struct
    for await (const row of iModel.query("SELECT Name FROM myschema.Company WHERE Location=?", [{ street: "7123 Main Street", zip: 30211 }])) {
      console.log(`${row.name}`);
    }
    // __PUBLISH_EXTRACT_END__
  }

  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_StructMembers
    for await (const row of iModel.query("SELECT Name FROM myschema.Company WHERE Location.Street=? AND Location.Zip=?", ["7123 Main Street", 32443])) {
      console.log(`${row.name}`);
    }
    // __PUBLISH_EXTRACT_END__
  }

  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_Array
    for await (const row of iModel.query("SELECT Name FROM myschema.Company WHERE PhoneNumbers=?", [["+16134584201", "+16134584202", "+16134584222"]])) {
      console.log(`${row.name}`);
    }
    // __PUBLISH_EXTRACT_END__
  }

  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_IllustrateRowFormat
    for await (const row of iModel.query("SELECT ECInstanceId,ECClassId,Parent,LastMod FROM bis.Element WHERE Model.Id=?", ["0x113"])) {
      console.log(`${row.id}, ${row.className}, ${row.parent}, ${row.lastMod}`);
    }
    // __PUBLISH_EXTRACT_END__
  }

  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_WorkingWithRowFormat
    console.log("ECInstanceId | ClassName | Parent Id | Parent RelClassName | LastMod");
    for await (const row of iModel.query("SELECT ECInstanceId,ECClassId,Parent,LastMod FROM bis.Element WHERE Model.Id=?", ["0x113"])) {
      const id: Id64String = row.id;
      const className: string = row.className;
      const parent: NavigationValue = row.parent;
      const lastMod: string = row.lastMod;

      console.log(id + "|" + className + "|" + parent.id + "|" + parent.relClassName + "|" + lastMod);
    }
    // __PUBLISH_EXTRACT_END__
  }
}

const dummyIModel: IModelConnection = {} as IModelConnection;
executeECSql_SampleMethod(dummyIModel).catch(() => { });
