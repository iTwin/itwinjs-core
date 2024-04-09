/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { SettingsSchemas } from "../../workspace/SettingsSchemas";
import { IModelTestUtils } from "../IModelTestUtils";

describe.only("SettingsSchemas", () => {

  it("add groups", () => {
    SettingsSchemas.reset();

    // can't add a group with no name
    expect(() => SettingsSchemas.addGroup({} as any)).throws(`has no "groupName" member`);

    SettingsSchemas.addFile(IModelTestUtils.resolveAssetFile("TestSettings.schema.json"));
    expect(SettingsSchemas.settingDefs.get("testApp/list/openMode")!.type).equals("string");
    expect(SettingsSchemas.settingDefs.get("testApp/list/openMode")!.default).equals("singleClick");
    expect(SettingsSchemas.settingDefs.get("testApp/tree/blah")!.default).equals(true);
  });

});
