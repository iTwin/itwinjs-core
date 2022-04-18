/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { SettingsSchemas } from "../../workspace/SettingsSchemas";
import { IModelTestUtils } from "../IModelTestUtils";

describe("SettingsSchemas", () => {

  it("add groups", () => {
    SettingsSchemas.reset();

    // can't add a group with no name
    let problems = SettingsSchemas.addGroup({} as any);
    expect(problems.length).equals(1);
    expect(problems[0]).contains(`has no "groupName" member`);

    SettingsSchemas.addGroup({ groupName: "app1" } as any);

    problems = SettingsSchemas.addFile(IModelTestUtils.resolveAssetFile("TestSettings.schema.json"));
    expect(problems.length).equals(0);

    expect(SettingsSchemas.allSchemas.get("app1/list/openMode")!.type).equals("string");
    expect(SettingsSchemas.allSchemas.get("app1/list/openMode")!.default).equals("singleClick");
    expect(SettingsSchemas.allSchemas.get("app1/tree/blah")!.default).equals(true);
  });

});
