/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IpcSocket, IpcSocketBackend, IpcSocketFrontend, RpcConfiguration, RpcInterfaceDefinition, RpcManager, RpcRegistry } from "@itwin/core-common";
import { ElectronRpcProtocol } from "./ElectronRpcProtocol";

/** RPC interface configuration for an Electron-based application.
 * @internal
 */
export abstract class ElectronRpcConfiguration extends RpcConfiguration {

  public static targetWindowId?: number;

  /** The protocol of the configuration. */
  public abstract override protocol: ElectronRpcProtocol;
}

/** Coordinates usage of RPC interfaces for an Electron-based application.
 * @internal
 */
export class ElectronRpcManager extends RpcManager {
  /** Initializes ElectronRpcManager for the frontend of an application. */
  public static initializeFrontend(ipcFrontend: IpcSocketFrontend, interfaces?: RpcInterfaceDefinition[]): ElectronRpcConfiguration {
    return ElectronRpcManager.performInitialization(ipcFrontend, interfaces);
  }

  /** Initializes ElectronRpcManager for the backend of an application. */
  public static initializeBackend(ipcBackend: IpcSocketBackend, interfaces?: RpcInterfaceDefinition[]): ElectronRpcConfiguration {
    return ElectronRpcManager.performInitialization(ipcBackend, interfaces);
  }

  private static performInitialization(ipcSocket: IpcSocket, rpcs?: RpcInterfaceDefinition[]): ElectronRpcConfiguration {
    const interfaces = rpcs ?? [];
    const config = class extends ElectronRpcConfiguration {
      public interfaces = () => interfaces;
      public protocol: ElectronRpcProtocol = new ElectronRpcProtocol(this, ipcSocket);
    };

    for (const def of interfaces) {
      RpcConfiguration.assign(def, () => config);
    }

    const instance = RpcConfiguration.obtain(config);
    RpcConfiguration.initializeInterfaces(instance);

    return instance;
  }

  /** Terminates ElectronRpcManager for the frontend of an application. */
  public static terminateFrontend() {
    return ElectronRpcManager.performTermination();
  }

  private static performTermination() {
    const definitions = RpcRegistry.instance.definitionClasses;

    for (const [, interfaceDef] of definitions) {
      RpcManager.terminateInterface(interfaceDef);
    }
  }
}
