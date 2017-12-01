/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelGateway } from "$(frontend)/lib/gateway/IModelGateway";
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
//import { assert } from "chai";

describe("IModelGateway", () => {
  it("should not open a blank filename", async () => {
    debugger;
    const opened = await IModelGateway.getProxy().openStandalone("", OpenMode.Readonly);
    debugger;
  });
});
