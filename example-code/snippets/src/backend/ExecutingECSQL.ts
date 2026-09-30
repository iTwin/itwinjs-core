/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ECSqlStatement, IModelDb, SnapshotDb } from "@itwin/core-backend";

/* eslint-disable @typescript-eslint/naming-convention */

function executeECSql_Binding(iModel: IModelDb) {
  // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_Navigation_ByParameter
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  iModel.withPreparedStatement("SELECT ECInstanceId FROM bis.Element WHERE Parent=?", (stmt: ECSqlStatement) => {
    stmt.bindNavigation(1, { id: "0x132" });
    // ...
  });
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_Struct_ByParameter
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  iModel.withPreparedStatement("SELECT Name FROM myschema.Company WHERE Location=?", (stmt: ECSqlStatement) => {
    stmt.bindStruct(1, { street: "7123 Main Street", zip: 30211 });
    // ...
  });
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ ExecuteECSql_Binding_Array_ByParameter
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  iModel.withPreparedStatement("SELECT Name FROM myschema.Company WHERE PhoneNumbers=?", (stmt: ECSqlStatement) => {
    stmt.bindArray(1, ["+16134584201", "+16134584202", "+16134584222"]);
    // ...
  });
  // __PUBLISH_EXTRACT_END__
}

const dummyIModel = SnapshotDb.openFile("");
executeECSql_Binding(dummyIModel);
