/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Schema, SchemaContext } from "@bentley/ecschema-metadata";
import { PendingExtension } from "../extension/Extension";
import { IModelApp } from "../IModelApp";
import { UNIT_SCHEMA_STRING } from "./public/assets/UnitSchema/UnitSchema";

describe("ExtensionAdmin tests", () => {
  beforeEach(async function () {
    this.timeout(5000);
    const schemaContext = new SchemaContext();
    Schema.fromJsonSync(UNIT_SCHEMA_STRING, schemaContext);
    await IModelApp.startup({ schemaContext });
  });
  afterEach(async function () {
    this.timeout(5000);
    await IModelApp.shutdown();
  });

  it("uses the first available ExtensionLoader", async () => {
    let calledFirst = false;
    let calledSecond = false;

    IModelApp.extensionAdmin.addExtensionLoaderFront({
      getExtensionName(_extensionRoot: string): string {
        return _extensionRoot;
      },
      async loadExtension(_extensionName: string, _extensionVersion?: string | undefined, _args?: string[] | undefined): Promise<PendingExtension | undefined> {
        calledSecond = true;
        return { promise: "fake" } as any;
      },
      resolveResourceUrl(name: string) { return name; },
    });

    IModelApp.extensionAdmin.addExtensionLoaderFront({
      getExtensionName(_extensionRoot: string): string {
        return _extensionRoot;
      },
      async loadExtension(_extensionName: string, _extensionVersion?: string | undefined, _args?: string[] | undefined): Promise<PendingExtension | undefined> {
        calledFirst = true;
        return { promise: "fake" } as any;
      },
      resolveResourceUrl(name: string) { return name; },
    });

    (window as any).iModelJsVersions = {
      get(_name: string) {
        return "dev";
      },
    };

    await IModelApp.extensionAdmin.loadExtension("testExt", "v1", ["arg1", "arg2"]);
    assert.isTrue(calledFirst);
    assert.isFalse(calledSecond);
  });

  it("uses the second available ExtensionLoader", async () => {
    let calledFirst = false;
    let calledSecond = false;
    IModelApp.extensionAdmin.addExtensionLoader({
      getExtensionName(_extensionRoot: string): string {
        return _extensionRoot;
      },
      async loadExtension(_extensionName: string, _extensionVersion?: string | undefined, _args?: string[] | undefined): Promise<PendingExtension | undefined> {
        calledFirst = true;
        return undefined;
      },
      resolveResourceUrl(name: string) { return name; },
    });
    IModelApp.extensionAdmin.addExtensionLoader({
      getExtensionName(_extensionRoot: string): string {
        return _extensionRoot;
      },
      async loadExtension(_extensionName: string, _extensionVersion?: string | undefined, _args?: string[] | undefined): Promise<PendingExtension | undefined> {
        calledSecond = true;
        return { promise: "fake" } as any;
      },
      resolveResourceUrl(name: string) { return name; },
    });

    (window as any).iModelJsVersions = {
      get(_name: string) {
        return "dev";
      },
    };

    await IModelApp.extensionAdmin.loadExtension("testExt", "v1", ["arg1", "arg2"]);
    assert.isTrue(calledFirst);
    assert.isTrue(calledSecond);
  });
});
