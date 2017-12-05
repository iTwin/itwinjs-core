/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelGateway } from "$(common)/lib/gateway/IModelGateway";
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { assert } from "chai";

describe("IModelGateway", () => {
  it("openStandalone should handle a blank filename", async () => {
    try {
      await IModelGateway.getProxy().openStandalone("", OpenMode.Readonly);
      assert(false);
    } catch (e) {
      assert(e.message.indexOf("DbResult.BE_SQLITE_NOTFOUND") !== -1);
    }
  });
});
