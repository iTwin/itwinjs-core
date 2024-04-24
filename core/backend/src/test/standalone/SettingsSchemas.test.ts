/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { SettingsSchemas } from "../../workspace/SettingsSchemas";
import { IModelTestUtils } from "../IModelTestUtils";
import { IModelHost } from "../../IModelHost";

describe("SettingsSchemas", () => {

  // SettingsSchema tests change the state of the IModelHost object. They should always clear
  // the current state before and after they run so they're not affected by, nor influence, other tests running in the same process.
  const restartSession = async () => {
    await IModelHost.shutdown();
    await IModelHost.startup();
  };
  before(async () => {
    await restartSession();
  });
  after(async () => {
    await restartSession();
  });

  it("add groups", async () => {
    // can't add a group with no name
    expect(() => SettingsSchemas.addGroup({} as any)).throws(`has no "schemaPrefix" member`);

    SettingsSchemas.addFile(IModelTestUtils.resolveAssetFile("TestSettings.schema.json"));
    expect(SettingsSchemas.settingDefs.get("testApp/list/openMode")!.type).equals("string");
    expect(SettingsSchemas.settingDefs.get("testApp/list/openMode")!.default).equals("singleClick");
    expect(SettingsSchemas.settingDefs.get("testApp/tree/blah")!.default).equals(true);
  });

});
