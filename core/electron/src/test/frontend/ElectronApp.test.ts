/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterEach, describe, expect, it } from "vitest";
import { EmptyLocalization, RpcInterface, RpcRegistry } from "@itwin/core-common";
import { IModelApp, NativeApp } from "@itwin/core-frontend";
import { ElectronApp } from "../../ElectronFrontend";

describe("ElectronApp tests.", () => {
  afterEach(async () => {
    if (ElectronApp.isValid)
      await ElectronApp.shutdown();
  });

  it("Should start and shutdown.", async () => {
    expect(ElectronApp.isValid).toBe(false);
    expect(NativeApp.isValid).toBe(false);
    expect(IModelApp.initialized).toBe(false);

    await ElectronApp.startup({ iModelApp: { localization: new EmptyLocalization() } });

    expect(ElectronApp.isValid).toBe(true);
    expect(NativeApp.isValid).toBe(true);
    expect(IModelApp.initialized).toBe(true);

    await ElectronApp.shutdown();

    expect(ElectronApp.isValid).toBe(false);
    expect(NativeApp.isValid).toBe(false);
    expect(IModelApp.initialized).toBe(false);
  });

  it("Should initialize and terminate provided RPC interfaces.", async () => {
    abstract class TestRpcInterface extends RpcInterface {
      public static readonly interfaceName = "TestRpcInterface";
      public static interfaceVersion = "0.0.0";
    }

    await ElectronApp.startup({
      iModelApp: {
        rpcInterfaces: [TestRpcInterface],
        localization: new EmptyLocalization(),
      },
    });
    expect(RpcRegistry.instance.definitionClasses.has(TestRpcInterface.interfaceName)).toBe(true);

    await ElectronApp.shutdown();
    expect(RpcRegistry.instance.definitionClasses.has(TestRpcInterface.interfaceName)).toBe(false);
  });
});
