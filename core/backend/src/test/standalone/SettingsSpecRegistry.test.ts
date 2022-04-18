/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { SettingsSchemas } from "../../workspace/SettingsSchemas";
import { IModelTestUtils } from "../IModelTestUtils";

describe("SettingsRegistry", () => {

  it("register groups", () => {
    SettingsSchemas.reset();

    // can't add a group with no name
    expect(() => SettingsSchemas.addGroup({} as any)).to.throw("settings group has no name");

    SettingsSchemas.addGroup({ groupName: "app1" } as any);

    const problems = SettingsSchemas.addFile(IModelTestUtils.resolveAssetFile("TestSettings.schema.json"));
    expect(problems.length).equals(0);

    expect(SettingsSchemas.allSchemas.get("app1/list/openMode")!.type).equals("string");
    expect(SettingsSchemas.allSchemas.get("app1/list/openMode")!.default).equals("singleClick");
    expect(SettingsSchemas.allSchemas.get("app1/tree/blah")!.default).equals(true);
  });

});
