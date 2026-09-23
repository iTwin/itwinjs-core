/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Id64String } from "@itwin/core-bentley";
import { NavigationValue, QueryBinder, QueryRowFormat } from "@itwin/core-common";
import { IModelConnection } from "@itwin/core-frontend";

/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/naming-convention */

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

async function executeECSql_HandlingRows(iModel: IModelConnection): Promise<void> {
  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_HandlingRows_ForLoopAccessByIndex
    for await (const row of iModel.createQueryReader("SELECT ECInstanceId, ECClassId FROM bis.Element")) {
      console.log(`ECInstanceId is ${row[0]}`);
      console.log(`ECClassId is ${row[1]}`);
    }
    // __PUBLISH_EXTRACT_END__
  }

  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_HandlingRows_StepAccessByIndex
    const reader = iModel.createQueryReader("SELECT ECInstanceId, ECClassId FROM bis.Element");
    while (await reader.step()) {
      console.log(`ECInstanceId is ${reader.current[0]}`);
      console.log(`ECClassId is ${reader.current[1]}`);
    }
    // __PUBLISH_EXTRACT_END__
  }

  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_HandlingRows_ForLoopAccessByName
    for await (const row of iModel.createQueryReader("SELECT ECInstanceId, ECClassId FROM bis.Element", undefined, { rowFormat: QueryRowFormat.UseECSqlPropertyNames })) {
      console.log(`ECInstanceId is ${row.ECInstanceId}`);
      console.log(`ECClassId is ${row.ECClassId}`);
    }
    // __PUBLISH_EXTRACT_END__
  }

  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_HandlingRows_StepAccessByName
    const reader = iModel.createQueryReader("SELECT ECInstanceId, ECClassId FROM bis.Element", undefined, { rowFormat: QueryRowFormat.UseECSqlPropertyNames });
    while (await reader.step()) {
      console.log(`ECInstanceId is ${reader.current.ECInstanceId}`);
      console.log(`ECClassId is ${reader.current.ECClassId}`);
    }
    // __PUBLISH_EXTRACT_END__
  }

  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_HandlingRows_Types
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    for await (const row of iModel.createQueryReader("SELECT ECInstanceId, ECClassId, Parent, LastMod FROM bis.Element WHERE Model.Id=?", QueryBinder.from(["0x10"]), { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
      const id: Id64String = row.id;
      const className: string = row.className;
      const parent: NavigationValue | undefined = row.parent;
      const lastMod: string = row.lastMod;
    }
    // __PUBLISH_EXTRACT_END__
  }

  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_HandlingRows_ForLoopJsLiteral
    for await (const row of iModel.createQueryReader("SELECT * FROM bis.Element")) {
      const jsRow: object = row.toRow(); // explicitly typed for example purposes
    }
    // __PUBLISH_EXTRACT_END__
  }

  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_HandlingRows_StepJsLiteral
    const reader = iModel.createQueryReader("SELECT * FROM bis.Element");
    while (await reader.step()) {
      const jsRow: object = reader.current.toRow(); // explicitly typed for example purposes
    }
    // __PUBLISH_EXTRACT_END__
  }

  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_HandlingRows_ToArrayJsLiteral
    const reader = iModel.createQueryReader("SELECT * FROM bis.Element", undefined, { rowFormat: QueryRowFormat.UseECSqlPropertyNames });
    const jsRows = await reader.toArray();
    // __PUBLISH_EXTRACT_END__
  }
}

async function executeECSql_QueryRowFormat(iModel: IModelConnection): Promise<void> {
  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_QueryRowFormat_UseECSqlPropertyIndexes
    for await (const row of iModel.createQueryReader("SELECT ECInstanceId, ECClassId, Parent, LastMod FROM bis.Element WHERE Model.Id=?", QueryBinder.from(["0x10"]), { rowFormat: QueryRowFormat.UseECSqlPropertyIndexes })) {
      console.log(`ECInstanceId is ${row[0]}`);
      console.log(`ECClassId is ${row[1]}`);
      console.log(`Parent is ${row[2]}`);
      console.log(`LastMod is ${row[3]}`);
    }
    // __PUBLISH_EXTRACT_END__
  }

  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_QueryRowFormat_UseECSqlPropertyIndexes_ToArray
    const reader = iModel.createQueryReader("SELECT ECInstanceId,ECClassId,Parent,LastMod FROM bis.Element WHERE Model.Id=?", QueryBinder.from(["0x10"]), { rowFormat: QueryRowFormat.UseECSqlPropertyIndexes });
    const jsRows = await reader.toArray();
    console.log(jsRows);
    // __PUBLISH_EXTRACT_END__
  }

  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_QueryRowFormat_UseECSqlPropertyNames
    for await (const row of iModel.createQueryReader("SELECT ECInstanceId, ECClassId, Parent, LastMod FROM bis.Element WHERE Model.Id=?", QueryBinder.from(["0x10"]), { rowFormat: QueryRowFormat.UseECSqlPropertyNames })) {
      console.log(`ECInstanceId is ${row.ECInstanceId}`);
      console.log(`ECClassId is ${row.ECClassId}`);
      console.log(`Parent is ${row.Parent}`);
      console.log(`LastMod is ${row.LastMod}`);
    }
    // __PUBLISH_EXTRACT_END__
  }

  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_QueryRowFormat_UseECSqlPropertyNames_ToArray
    const reader = iModel.createQueryReader("SELECT ECInstanceId,ECClassId,Parent,LastMod FROM bis.Element WHERE Model.Id=?", QueryBinder.from(["0x10"]), { rowFormat: QueryRowFormat.UseECSqlPropertyNames });
    const jsRows = await reader.toArray();
    console.log(jsRows);
    // __PUBLISH_EXTRACT_END__
  }

  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_QueryRowFormat_UseJsPropertyNames
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    for await (const row of iModel.createQueryReader("SELECT ECInstanceId,ECClassId,Parent,LastMod FROM bis.Element WHERE Model.Id=?", QueryBinder.from(["0x10"]), { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
      console.log(`ECInstanceId is ${row.id}`);
      console.log(`ECClassId is ${row.className}`);
      console.log(`Parent is ${row.parent}`);
      console.log(`LastMod is ${row.lastMod}`);
    }
    // __PUBLISH_EXTRACT_END__
  }

  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_QueryRowFormat_UseJsPropertyNames_ToArray
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const reader = iModel.createQueryReader("SELECT ECInstanceId,ECClassId,Parent,LastMod FROM bis.Element WHERE Model.Id=?", QueryBinder.from(["0x10"]), { rowFormat: QueryRowFormat.UseJsPropertyNames });
    const jsRows = await reader.toArray();
    console.log(jsRows);
    // __PUBLISH_EXTRACT_END__
  }
}

async function executeECSql_Binding(iModel: IModelConnection): Promise<void> {
  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_Positional
    for await (const row of iModel.createQueryReader("SELECT ECInstanceId,ECClassId,Parent,LastMod FROM bis.Element WHERE CodeValue=? AND LastMod>=?",
      QueryBinder.from(["MyCode", "2018-01-01T12:00:00Z"]), { rowFormat: QueryRowFormat.UseECSqlPropertyNames })) {
      console.log(`${row.ECInstanceId}, ${row.ECClassId}, ${row.Parent}, ${row.LastMod}`);
    }
    // __PUBLISH_EXTRACT_END__

  }

  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_Named
    for await (const row of iModel.createQueryReader("SELECT ECInstanceId,ECClassId,Parent,LastMod FROM bis.Element WHERE CodeValue=:code AND LastMod>=:lastmod",
      QueryBinder.from({ code: "MyCode", lastmod: "2018-01-01T12:00:00Z" }), { rowFormat: QueryRowFormat.UseECSqlPropertyNames })) {
      console.log(`${row.ECInstanceId}, ${row.ECClassId}, ${row.Parent}, ${row.LastMod}`);
    }
    // __PUBLISH_EXTRACT_END__
  }

  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_NavigationId
    for await (const row of iModel.createQueryReader("SELECT ECInstanceId FROM bis.Element WHERE Parent.Id=?", new QueryBinder().bindId(1, "0x132"), { rowFormat: QueryRowFormat.UseECSqlPropertyNames })) {
      console.log(`${row.ECInstanceId}`);
    }
    // __PUBLISH_EXTRACT_END__
  }

  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_IdSet
    const binder = new QueryBinder().bindIdSet(1, ["0x1", "0x2"]);
    for await (const row of iModel.createQueryReader("SELECT ECInstanceId, ECClassId FROM bis.Element WHERE InVirtualSet(?, ECInstanceId)", binder, { rowFormat: QueryRowFormat.UseECSqlPropertyNames })) {
      console.log(`${row.ECInstanceId}, ${row.ECClassId}`);
    }
    // __PUBLISH_EXTRACT_END__
  }

  {
    // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_StructMembers
    for await (const row of iModel.createQueryReader("SELECT Name FROM myschema.Company WHERE Location.Street=? AND Location.Zip=?", QueryBinder.from(["7123 Main Street", 32443]), { rowFormat: QueryRowFormat.UseECSqlPropertyNames })) {
      console.log(`${row.Name}`);
    }
    // __PUBLISH_EXTRACT_END__
  }

}

const dummyIModel: IModelConnection = {} as IModelConnection;
executeECSql_ECSqlReaderIteration(dummyIModel).catch(() => { });
executeECSql_HandlingRows(dummyIModel).catch(() => { });
executeECSql_QueryRowFormat(dummyIModel).catch(() => { });
executeECSql_Binding(dummyIModel).catch(() => { });
