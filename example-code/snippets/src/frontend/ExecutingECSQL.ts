/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Id64String } from "@itwin/core-bentley";
import { NavigationValue, QueryBinder, QueryRowFormat } from "@itwin/core-common";
import { IModelConnection } from "@itwin/core-frontend";

/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/naming-convention */

async function executeECSql_SampleMethod(iModel: IModelConnection): Promise<void> {
  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_Positional
    for await (const row of iModel.createQueryReader("SELECT ECInstanceId,ECClassId,Parent,LastMod FROM bis.Element WHERE CodeValue=? AND LastMod>=?",
      QueryBinder.from(["MyCode", "2018-01-01T12:00:00Z"]), { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
      console.log(`${row.id}, ${row.className}, ${row.parent}, ${row.lastMod}`);
    }
    // __PUBLISH_EXTRACT_END__

  }

  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_Named
    for await (const row of iModel.createQueryReader("SELECT ECInstanceId,ECClassId,Parent,LastMod FROM bis.Element WHERE CodeValue=:code AND LastMod>=:lastmod",
      QueryBinder.from({ code: "MyCode", lastmod: "2018-01-01T12:00:00Z" }), { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
      console.log(`${row.id}, ${row.className}, ${row.parent}, ${row.lastMod}`);
    }
    // __PUBLISH_EXTRACT_END__
  }

  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_Navigation
    for await (const row of iModel.createQueryReader("SELECT ECInstanceId FROM bis.Element WHERE Parent=?", QueryBinder.from([{ id: "0x132" }]), { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
      console.log(`${row.id}`);
    }
    // __PUBLISH_EXTRACT_END__
  }

  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_NavigationId
    for await (const row of iModel.createQueryReader("SELECT ECInstanceId FROM bis.Element WHERE Parent.Id=?", QueryBinder.from(["0x132"]), { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
      console.log(`${row.id}`);
    }
    // __PUBLISH_EXTRACT_END__
  }

  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_Struct
    for await (const row of iModel.createQueryReader("SELECT Name FROM myschema.Company WHERE Location=?", QueryBinder.from([{ street: "7123 Main Street", zip: 30211 }]), { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
      console.log(`${row.name}`);
    }
    // __PUBLISH_EXTRACT_END__
  }

  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_StructMembers
    for await (const row of iModel.createQueryReader("SELECT Name FROM myschema.Company WHERE Location.Street=? AND Location.Zip=?", QueryBinder.from(["7123 Main Street", 32443]), { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
      console.log(`${row.name}`);
    }
    // __PUBLISH_EXTRACT_END__
  }

  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_Array
    for await (const row of iModel.createQueryReader("SELECT Name FROM myschema.Company WHERE PhoneNumbers=?", QueryBinder.from([["+16134584201", "+16134584202", "+16134584222"]]), { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
      console.log(`${row.name}`);
    }
    // __PUBLISH_EXTRACT_END__
  }

  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_IllustrateRowFormat
    for await (const row of iModel.createQueryReader("SELECT ECInstanceId,ECClassId,Parent,LastMod FROM bis.Element WHERE Model.Id=?", QueryBinder.from(["0x113"]), { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
      console.log(`${row.id}, ${row.className}, ${row.parent}, ${row.lastMod}`);
    }
    // __PUBLISH_EXTRACT_END__
  }

  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_WorkingWithRowFormat
    console.log("ECInstanceId | ClassName | Parent Id | Parent RelClassName | LastMod");
    for await (const row of iModel.createQueryReader("SELECT ECInstanceId,ECClassId,Parent,LastMod FROM bis.Element WHERE Model.Id=?", QueryBinder.from(["0x113"]), { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
      const id: Id64String = row.id;
      const className: string = row.className;
      const parent: NavigationValue = row.parent;
      const lastMod: string = row.lastMod;

      console.log(`${id}|${className}|${parent.id}|${parent.relClassName}|${lastMod}`);
    }
    // __PUBLISH_EXTRACT_END__
  }
}

async function executeECSql_ECSqlReaderIteration(iModel: IModelConnection): Promise<void> {
  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_ECSqlReaderIteration_AsynchronousIterator
    for await (const row of iModel.createQueryReader("SELECT ECInstanceId, ECClassId FROM bis.Element")) {
      console.log(`ECInstanceId is ${row[0]}`);
      console.log(`ECClassId is ${row.ecclassid}`);
    }
    // __PUBLISH_EXTRACT_END__
  }

  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_ECSqlReaderIteration_ManualIteration
    const reader = iModel.createQueryReader("SELECT ECInstanceId, ECClassId FROM bis.Element");
    while (await reader.step()) {
      console.log(`ECInstanceId is ${reader.current[0]}`);
      console.log(`ECClassId is ${reader.current.ecclassid}`);
    }
    // __PUBLISH_EXTRACT_END__
  }

  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_ECSqlReaderIteration_ToArray
    const reader = iModel.createQueryReader("SELECT ECInstanceId, ECClassId FROM bis.Element");
    const allRows = await reader.toArray();
    console.log(`First ECInstanceId is ${allRows[0][0]}`);
    console.log(`First ECClassId is ${allRows[0][1]}`);
    // __PUBLISH_EXTRACT_END__
  }
}

const dummyIModel: IModelConnection = {} as IModelConnection;
executeECSql_SampleMethod(dummyIModel).catch(() => { });
executeECSql_ECSqlReaderIteration(dummyIModel).catch(() => { });
