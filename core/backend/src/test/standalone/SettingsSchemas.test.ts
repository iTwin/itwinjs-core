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

  it("resolveSchema resolves object extends chains recursively", () => {
    const schemas = IModelHost.settingsSchemas;
    const prefix = "resolve-schema-object";
    schemas.removeGroup(prefix);
    schemas.addGroup({
      schemaPrefix: prefix,
      description: "schema used to test object resolution",
      typeDefs: {
        nestedBase: {
          type: "object",
          required: ["nestedReq"],
          properties: {
            nestedReq: { type: "integer" },
            nestedBaseOnly: { type: "string" },
          },
        },
        baseThing: {
          type: "object",
          required: ["baseReq"],
          properties: {
            baseReq: { type: "string" },
            overridden: { type: "string" },
            baseOnly: { type: "number" },
            nested: {
              type: "object",
              extends: `${prefix}/nestedBase`,
              properties: {
                nestedChildOnly: { type: "boolean" },
              },
            },
          },
        },
      },
      settingDefs: {
        thing: {
          type: "object",
          extends: `${prefix}/baseThing`,
          required: ["derivedReq"],
          properties: {
            derivedReq: { type: "boolean" },
            overridden: { type: "number" },
          },
        },
      },
    });

    try {
      const resolved = schemas.resolveSchema(schemas.settingDefs.get(`${prefix}/thing`)!);
      expect(resolved.type).to.equal("object");
      expect(resolved).to.not.have.property("extends");
      expect(resolved.required).to.have.members(["baseReq", "derivedReq"]);
      expect(resolved.properties).to.include.keys("baseReq", "baseOnly", "derivedReq", "overridden", "nested");
      expect(resolved.properties?.overridden.type).to.equal("number");
      expect(resolved.properties?.baseOnly.type).to.equal("number");

      const nested = resolved.properties?.nested;
      expect(nested?.type).to.equal("object");
      expect(nested).to.not.have.property("extends");
      expect(nested?.required).to.have.members(["nestedReq"]);
      expect(nested?.properties).to.include.keys("nestedReq", "nestedBaseOnly", "nestedChildOnly");
    } finally {
      schemas.removeGroup(prefix);
    }
  });

  it("resolveSchema resolves array items through extends", () => {
    const schemas = IModelHost.settingsSchemas;
    const prefix = "resolve-schema-array";
    schemas.removeGroup(prefix);
    schemas.addGroup({
      schemaPrefix: prefix,
      description: "schema used to test array resolution",
      typeDefs: {
        stringList: {
          type: "array",
          items: { type: "string" },
        },
      },
      settingDefs: {
        names: {
          type: "array",
          extends: `${prefix}/stringList`,
        },
      },
    });

    try {
      const resolved = schemas.resolveSchema(schemas.settingDefs.get(`${prefix}/names`)!);
      expect(resolved.type).to.equal("array");
      expect(resolved).to.not.have.property("extends");
      expect(resolved.items?.type).to.equal("string");
      expect(resolved.items).to.not.have.property("extends");
    } finally {
      schemas.removeGroup(prefix);
    }
  });

  it("resolveSchema throws when an extends target cannot be found", () => {
    const schemas = IModelHost.settingsSchemas;
    expect(() => schemas.resolveSchema({ type: "object", extends: "missing/type" })).to.throw("typeDef missing/type does not exist");
  });

});
