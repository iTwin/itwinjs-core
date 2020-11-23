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

/** @internal */
export interface IModelElectronIpc {
  on: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
  once: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
  removeListener: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
  send: (channel: string, ...data: any[]) => void; // only valid for render -> main
}

/** @internal */
export interface IModelElectronApi extends IModelElectronIpc {
  invoke(channel: string, ...args: any[]): Promise<any>;
  sendSync(channel: string, ...args: any[]): any;
}

/** Get the iModel.js api object published by the Preload script. Allows frontend applications
 * to use selected electron apis with NodeIntegration off.
 * @note Frontend use only.
 * @see @bentley/electron-manager/ElectronPreload.ts
 * @internal */
export const getIModelElectronApi = () => typeof window === "undefined" ? undefined : (window as any).imodeljs_api as IModelElectronApi | undefined;

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
  public static initializeClient(params: ElectronRpcParams, interfaces: RpcInterfaceDefinition[]): ElectronRpcConfiguration {
    return ElectronRpcManager.performInitialization(params, interfaces);
  }

  /** Initializes ElectronRpcManager for the backend of an application. */
  public static initializeImpl(params: ElectronRpcParams, interfaces: RpcInterfaceDefinition[]): ElectronRpcConfiguration {
    return ElectronRpcManager.performInitialization(params, interfaces);
  }

  private static performInitialization(params: ElectronRpcParams, interfaces: RpcInterfaceDefinition[]): ElectronRpcConfiguration {
    const protocol = params.protocol ?? ElectronRpcProtocol;

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
