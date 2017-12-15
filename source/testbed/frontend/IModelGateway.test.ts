/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelGateway } from "@build/imodeljs-core/lib/gateway/IModelGateway";
import { OpenMode } from "@build/imodeljs-core/node_modules/@bentley/bentleyjs-core/lib/BeSQLite";
import { assert } from "chai";

describe("IModelGateway", () => {
  it("openStandalone should handle a blank filename", async () => {
    try {
      await IModelGateway.getProxy().openStandalone("", OpenMode.Readonly);
      assert(false);
    } catch (e) {
      assert(true);
    }
  });
});
