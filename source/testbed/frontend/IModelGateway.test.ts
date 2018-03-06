/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelGateway } from "@bentley/imodeljs-common";
import { OpenMode } from "@bentley/bentleyjs-core";
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
