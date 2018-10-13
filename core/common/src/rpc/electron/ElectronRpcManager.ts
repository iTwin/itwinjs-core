/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { RpcInterfaceDefinition } from "../../RpcInterface";
import { RpcManager } from "../../RpcManager";
import { RpcConfiguration } from "../core/RpcConfiguration";
import { ElectronRpcProtocol, interop } from "./ElectronRpcProtocol";

/** Initialization parameters for ElectronRpcConfiguration. */
export interface ElectronRpcParams {
  protocol?: typeof ElectronRpcProtocol;
}

/** RPC interface configuration for an Electron-based application. */
export abstract class ElectronRpcConfiguration extends RpcConfiguration {
  public static get isElectron() { return interop !== null; }

  /** The protocol of the configuration. */
  public abstract protocol: ElectronRpcProtocol;
}

/** Coordinates usage of RPC interfaces for an Electron-based application. */
export class ElectronRpcManager extends RpcManager {
  /** Initializes ElectronRpcManager for the frontend of an application. */
  public static initializeClient(params: ElectronRpcParams, interfaces: RpcInterfaceDefinition[]): ElectronRpcConfiguration {
    return ElectronRpcManager.performInitialization(params, interfaces);
  }

  /** Initializes ElectronRpcManager for the backend of an application. */
  public static initializeImpl(params: ElectronRpcParams, interfaces: RpcInterfaceDefinition[]): ElectronRpcConfiguration {
    return ElectronRpcManager.performInitialization(params, interfaces);
  }

  private static performInitialization(params: ElectronRpcParams, interfaces: RpcInterfaceDefinition[]): ElectronRpcConfiguration {
    const protocol = (params.protocol || ElectronRpcProtocol);

    const config = class extends ElectronRpcConfiguration {
      public interfaces = () => interfaces;
      public protocol: ElectronRpcProtocol = new protocol(this);
    };

    for (const def of interfaces) {
      RpcConfiguration.assign(def, () => config);
    }

    const instance = RpcConfiguration.obtain(config);
    RpcConfiguration.initializeInterfaces(instance);

    return instance;
  }
}
