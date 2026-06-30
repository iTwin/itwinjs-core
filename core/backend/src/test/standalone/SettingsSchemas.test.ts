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
      const resolved = schemas.getResolvedSettingDef(`${prefix}/thing`)!;
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

      const resolvedPreservingExtends = schemas.getResolvedSettingDef(`${prefix}/thing`, { preserveExtends: true })!;
      expect(resolvedPreservingExtends.type).to.equal("object");
      expect(resolvedPreservingExtends.extends).to.equal(`${prefix}/baseThing`);
      expect(resolvedPreservingExtends.required).to.have.members(["baseReq", "derivedReq"]);
      expect(resolvedPreservingExtends.properties).to.include.keys("baseReq", "baseOnly", "derivedReq", "overridden", "nested");
      expect(resolvedPreservingExtends.properties?.overridden.type).to.equal("number");
      expect(resolvedPreservingExtends.properties?.baseOnly.type).to.equal("number");

      const nestedPreservingExtends = resolvedPreservingExtends.properties?.nested;
      expect(nestedPreservingExtends?.type).to.equal("object");
      expect(nestedPreservingExtends?.extends).to.equal(`${prefix}/nestedBase`);
      expect(nestedPreservingExtends?.required).to.have.members(["nestedReq"]);
      expect(nestedPreservingExtends?.properties).to.include.keys("nestedReq", "nestedBaseOnly", "nestedChildOnly");
    } finally {
      schemas.removeGroup(prefix);
    }
  });

  it("resolveSchema includes inherited properties from object typedefs", () => {
    const schemas = IModelHost.settingsSchemas;
    const prefix = "resolve-schema-object-inherited-props";
    schemas.removeGroup(prefix);
    schemas.addGroup({
      schemaPrefix: prefix,
      description: "schema used to test inherited object properties",
      typeDefs: {
        baseThing: {
          type: "object",
          properties: {
            inheritedName: { type: "string" },
            inheritedEnabled: { type: "boolean" },
          },
        },
      },
      settingDefs: {
        thing: {
          type: "object",
          extends: `${prefix}/baseThing`,
          properties: {
            localCount: { type: "integer" },
          },
        },
      },
    });

    try {
      const resolved = schemas.getResolvedSettingDef(`${prefix}/thing`)!;
      expect(resolved.properties).to.include.keys("inheritedName", "inheritedEnabled", "localCount");
      expect(resolved.properties?.inheritedName.type).to.equal("string");
      expect(resolved.properties?.inheritedEnabled.type).to.equal("boolean");
      expect(resolved.properties?.localCount.type).to.equal("integer");
    } finally {
      schemas.removeGroup(prefix);
    }
  });

  it("resolveSchema deduplicates required properties inherited from object typedefs", () => {
    const schemas = IModelHost.settingsSchemas;
    const prefix = "resolve-schema-object-required";
    schemas.removeGroup(prefix);
    schemas.addGroup({
      schemaPrefix: prefix,
      description: "schema used to test required property deduplication",
      typeDefs: {
        baseThing: {
          type: "object",
          required: ["sharedReq", "baseReq"],
          properties: {
            sharedReq: { type: "string" },
            baseReq: { type: "boolean" },
            derivedReq: { type: "integer" },
          },
        },
      },
      settingDefs: {
        thing: {
          type: "object",
          extends: `${prefix}/baseThing`,
          required: ["sharedReq", "derivedReq"],
          properties: {
            sharedReq: { type: "string" },
            derivedReq: { type: "integer" },
          },
        },
      },
    });

    try {
      const resolved = schemas.getResolvedSettingDef(`${prefix}/thing`)!;
      expect(resolved.required).to.have.members(["sharedReq", "baseReq", "derivedReq"]);
      expect(resolved.required?.filter((name) => name === "sharedReq")).to.have.lengthOf(1);
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
          combineArray: true,
          minItems: 1,
          description: "base array typedef",
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
      const resolved = schemas.getResolvedSettingDef(`${prefix}/names`)!;
      expect(resolved.type).to.equal("array");
      expect(resolved).to.not.have.property("extends");
      expect(resolved.combineArray).to.equal(true);
      expect(resolved.minItems).to.equal(1);
      expect(resolved.description).to.equal("base array typedef");
      expect(resolved.items?.type).to.equal("string");
      expect(resolved.items).to.not.have.property("extends");
    } finally {
      schemas.removeGroup(prefix);
    }
  });

  it("resolveSchema lets derived array schema properties override inherited typedef properties", () => {
    const schemas = IModelHost.settingsSchemas;
    const prefix = "resolve-schema-array-overrides";
    schemas.removeGroup(prefix);
    schemas.addGroup({
      schemaPrefix: prefix,
      description: "schema used to test array override precedence",
      typeDefs: {
        stringList: {
          type: "array",
          combineArray: true,
          minItems: 1,
          description: "base array typedef",
          items: { type: "string" },
        },
      },
      settingDefs: {
        names: {
          type: "array",
          extends: `${prefix}/stringList`,
          combineArray: false,
          minItems: 3,
          description: "derived array schema",
        },
      },
    });

    try {
      const resolved = schemas.getResolvedSettingDef(`${prefix}/names`)!;
      expect(resolved.combineArray).to.equal(false);
      expect(resolved.minItems).to.equal(3);
      expect(resolved.description).to.equal("derived array schema");
      expect(resolved.items?.type).to.equal("string");
    } finally {
      schemas.removeGroup(prefix);
    }
  });

  it("resolveSchema resolves array items through multi-level typedef inheritance", () => {
    const schemas = IModelHost.settingsSchemas;
    const prefix = "resolve-schema-array-multilevel";
    schemas.removeGroup(prefix);
    schemas.addGroup({
      schemaPrefix: prefix,
      description: "schema used to test multi-level array typedef inheritance",
      typeDefs: {
        c: {
          type: "array",
          combineArray: true,
          items: { type: "string" },
        },
        b: {
          type: "array",
          extends: `${prefix}/c`,
        },
      },
      settingDefs: {
        names: {
          type: "array",
          extends: `${prefix}/b`,
        },
      },
    });

    try {
      const resolved = schemas.getResolvedSettingDef(`${prefix}/names`)!;
      expect(resolved.combineArray).to.equal(true);
      expect(resolved.items?.type).to.equal("string");
    } finally {
      schemas.removeGroup(prefix);
    }
  });

  it("getResolvedSettingDef returns a resolved setting schema by name", () => {
    const schemas = IModelHost.settingsSchemas;
    const prefix = "resolve-setting-schema";
    schemas.removeGroup(prefix);
    schemas.addGroup({
      schemaPrefix: prefix,
      description: "schema used to test resolved setting schema lookup",
      typeDefs: {
        stringList: {
          type: "array",
          combineArray: true,
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
      const resolved = schemas.getResolvedSettingDef(`${prefix}/names`);
      expect(resolved).to.not.be.undefined;
      expect(resolved?.type).to.equal("array");
      expect(resolved).to.not.have.property("extends");
      expect(resolved?.combineArray).to.equal(true);
      expect(resolved?.items?.type).to.equal("string");
      expect(schemas.getResolvedSettingDef(`${prefix}/missing`)).to.be.undefined;
    } finally {
      schemas.removeGroup(prefix);
    }
  });

  it("getResolvedSettingDef resolves built-in workspace settings schemas", () => {
    const schemas = IModelHost.settingsSchemas;

    const resolved = schemas.getResolvedSettingDef("itwin/core/workspace/settingsWorkspaces");
    expect(resolved).to.not.be.undefined;
    expect(resolved?.type).to.equal("array");
    expect(resolved?.items?.type).to.equal("object");
    expect(resolved?.items).to.not.have.property("extends");
    expect(resolved?.items?.required).to.have.members(["containerId", "baseUri"]);
    expect(resolved?.items?.properties).to.include.keys("dbName", "baseUri", "containerId", "storageType", "resourceName", "priority");
    expect(resolved?.items?.properties?.storageType.default).to.equal("azure");
  });

  it("getResolvedSettingDef throws on circular typedef references", () => {
    const schemas = IModelHost.settingsSchemas;
    const prefix = "resolve-schema-cycle";
    schemas.removeGroup(prefix);
    schemas.addGroup({
      schemaPrefix: prefix,
      description: "schema used to test circular typedef resolution",
      typeDefs: {
        a: {
          type: "object",
          extends: `${prefix}/b`,
          properties: {
            aOnly: { type: "string" },
          },
        },
        b: {
          type: "object",
          extends: `${prefix}/a`,
          properties: {
            bOnly: { type: "string" },
          },
        },
      },
      settingDefs: {
        thing: {
          type: "object",
          extends: `${prefix}/a`,
        },
      },
    });

    try {
      expect(() => schemas.getResolvedSettingDef(`${prefix}/thing`)).to.throw("circular typeDef reference detected");
    } finally {
      schemas.removeGroup(prefix);
    }
  });

  it("getResolvedSettingDef throws on nested recursive typedef references", () => {
    const schemas = IModelHost.settingsSchemas;
    const prefix = "resolve-schema-nested-cycle";
    schemas.removeGroup(prefix);
    schemas.addGroup({
      schemaPrefix: prefix,
      description: "schema used to test nested recursive typedef resolution",
      typeDefs: {
        node: {
          type: "object",
          properties: {
            child: {
              type: "object",
              extends: `${prefix}/node`,
            },
          },
        },
      },
      settingDefs: {
        root: {
          type: "object",
          extends: `${prefix}/node`,
        },
      },
    });

    try {
      expect(() => schemas.getResolvedSettingDef(`${prefix}/root`)).to.throw("circular typeDef reference detected");
    } finally {
      schemas.removeGroup(prefix);
    }
  });

  it("getResolvedSettingDef throws when an extends target cannot be found", () => {
    const schemas = IModelHost.settingsSchemas;
    const prefix = "resolve-schema-missing-typedef";
    schemas.removeGroup(prefix);
    schemas.addGroup({
      schemaPrefix: prefix,
      description: "schema used to test missing typedef resolution",
      settingDefs: {
        thing: {
          type: "object",
          extends: `${prefix}/missingType`,
        },
      },
    });

    try {
      expect(() => schemas.getResolvedSettingDef(`${prefix}/thing`)).to.throw(`typeDef ${prefix}/missingType does not exist`);
    } finally {
      schemas.removeGroup(prefix);
    }
  });

});
