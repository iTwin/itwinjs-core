/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { IModelTestUtils } from "../IModelTestUtils";
import { IModelHost } from "../../IModelHost";
import { TestUtils } from "../TestUtils";

describe("SettingsSchemas", () => {

  // SettingsSchema tests change the state of the IModelHost object. They should always clear
  // the current state before and after they run so they're not affected by, nor influence, other tests running in the same process.
  const restartSession = async () => {
    await IModelHost.shutdown();
    await TestUtils.startBackend();
  };
  before(async () => {
    await restartSession();
  });
  after(async () => {
    await restartSession();
  });

  it("add groups", async () => {
    const schemas = IModelHost.settingsSchemas;
    // can't add a group with no name
    expect(() => schemas.addGroup({} as any)).throws(`has no "schemaPrefix" member`);

    schemas.addGroup({
      schemaPrefix: "title-test",
      title: "Title Test",
      description: "schema with a user-facing title",
      settingDefs: {
        setting: {
          type: "string",
        },
      },
    });
    expect(schemas.groups.get("title-test")?.title).equals("Title Test");
    expect(schemas.groups.get("title-test")?.description).equals("schema with a user-facing title");
    expect(schemas.settingDefs.get("title-test/setting")!.type).equals("string");

    schemas.addFile(IModelTestUtils.resolveAssetFile("TestSettings.schema.json"));
    expect(schemas.groups.get("testApp")?.title).equals("Test App");
    expect(schemas.groups.get("testApp")?.description).equals("the settings for test application 1");
    expect(schemas.settingDefs.get("testApp/list/openMode")!.type).equals("string");
    expect(schemas.settingDefs.get("testApp/list/openMode")!.default).equals("singleClick");
    expect(schemas.settingDefs.get("testApp/tree/blah")!.default).equals(true);
  });

});
