/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { SettingsSpecRegistry } from "../../workspace/SettingsSpecRegistry";
import { IModelTestUtils } from "../IModelTestUtils";

describe("SettingsRegistry", () => {

  it("register groups", () => {
    SettingsSpecRegistry.reset();

    // can't add a group with no name
    expect(() => SettingsSpecRegistry.addGroup({} as any)).to.throw("settings group has no name");

    SettingsSpecRegistry.addGroup({ groupName: "app1" } as any);

    const problems = SettingsSpecRegistry.addFile(IModelTestUtils.resolveAssetFile("TestSettings.schema.json"));
    expect(problems.length).equals(0);

    expect(SettingsSpecRegistry.allSpecs.get("app1/list/openMode")!.type).equals("string");
    expect(SettingsSpecRegistry.allSpecs.get("app1/list/openMode")!.default).equals("singleClick");
    expect(SettingsSpecRegistry.allSpecs.get("app1/tree/blah")!.default).equals(true);
  });

});
