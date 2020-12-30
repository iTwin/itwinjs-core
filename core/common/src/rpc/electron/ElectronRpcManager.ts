/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { RpcInterfaceDefinition } from "../../RpcInterface";
import { RpcManager } from "../../RpcManager";
import { RpcConfiguration } from "../core/RpcConfiguration";
import { ElectronRpcProtocol } from "./ElectronRpcProtocol";
import { isElectronMain, isElectronRenderer } from "@bentley/bentleyjs-core";
import { IpcSocket, IpcSocketBackend, IpcSocketFrontend } from "../../ipc/IpcSocket";

/** Initialization parameters for ElectronRpcConfiguration.
 * @beta
 */
export interface ElectronRpcParams {
  protocol?: typeof ElectronRpcProtocol;
}

/** RPC interface configuration for an Electron-based application.
 * @beta
 */
export abstract class ElectronRpcConfiguration extends RpcConfiguration {
  public static readonly isElectron = isElectronMain || isElectronRenderer;

  public static targetWindowId?: number;

  /** The protocol of the configuration. */
  public abstract protocol: ElectronRpcProtocol;
}

/** Coordinates usage of RPC interfaces for an Electron-based application.
 * @beta
 */
export class ElectronRpcManager extends RpcManager {
  /** Initializes ElectronRpcManager for the frontend of an application. */
  public static initializeClient(params: ElectronRpcParams, interfaces: RpcInterfaceDefinition[], ipcFrontend: IpcSocketFrontend): ElectronRpcConfiguration {
    return ElectronRpcManager.performInitialization(params, interfaces, ipcFrontend);
  }

  /** Initializes ElectronRpcManager for the backend of an application. */
  public static initializeImpl(params: ElectronRpcParams, interfaces: RpcInterfaceDefinition[], ipcBackend: IpcSocketBackend): ElectronRpcConfiguration {
    return ElectronRpcManager.performInitialization(params, interfaces, ipcBackend);
  }

  private static performInitialization(params: ElectronRpcParams, interfaces: RpcInterfaceDefinition[], ipcSocket: IpcSocket): ElectronRpcConfiguration {
    const protocol = params.protocol ?? ElectronRpcProtocol;

    const config = class extends ElectronRpcConfiguration {
      public interfaces = () => interfaces;
      public protocol: ElectronRpcProtocol = new protocol(this, ipcSocket);
    };

    for (const def of interfaces) {
      RpcConfiguration.assign(def, () => config);
    }

    const instance = RpcConfiguration.obtain(config);
    RpcConfiguration.initializeInterfaces(instance);

    return instance;
  }
}
