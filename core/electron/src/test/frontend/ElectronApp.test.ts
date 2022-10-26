/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { IModelReadRpcInterface, IModelTileRpcInterface, RpcInterface, RpcRegistry, SnapshotIModelRpcInterface } from "@itwin/core-common";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { IModelApp, NativeApp } from "@itwin/core-frontend";
import { ElectronApp } from "../../ElectronFrontend";

describe("ElectronApp tests.", () => {
  it("Should start and shutdown.", async () => {
    assert(!ElectronApp.isValid);
    assert(!NativeApp.isValid);
    assert(!IModelApp.initialized);

    await ElectronApp.startup();

    assert(ElectronApp.isValid);
    assert(NativeApp.isValid);
    assert(IModelApp.initialized);

    await ElectronApp.shutdown();

    assert(!ElectronApp.isValid);
    assert(!NativeApp.isValid);
    assert(!IModelApp.initialized);
  });

  it("Should initialize and terminate provided RPC interfaces.", async () => {
    abstract class TestRpcInterface extends RpcInterface {
      public static readonly interfaceName = "TestRpcInterface";
      public static interfaceVersion = "0.0.0";
    }

    await ElectronApp.startup({
      iModelApp: {
        rpcInterfaces: [TestRpcInterface],
      },
    });
    assert(RpcRegistry.instance.definitionClasses.has(TestRpcInterface.interfaceName));

    await ElectronApp.shutdown();
    assert(!RpcRegistry.instance.definitionClasses.has(TestRpcInterface.interfaceName));
  });

  it("Should initialize and terminate default RPC interfaces.", async () => {
    const defaultInterfaces = [
      IModelReadRpcInterface,
      IModelTileRpcInterface,
      SnapshotIModelRpcInterface,
      PresentationRpcInterface,
    ];

    await ElectronApp.startup();
    for (const interfaceDef of defaultInterfaces)
      assert(RpcRegistry.instance.definitionClasses.has(interfaceDef.interfaceName));

    await ElectronApp.shutdown();
    for (const interfaceDef of defaultInterfaces)
      assert(!RpcRegistry.instance.definitionClasses.has(interfaceDef.interfaceName));
  });
});
