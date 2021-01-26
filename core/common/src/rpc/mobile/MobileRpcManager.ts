/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { RpcInterfaceDefinition } from "../../RpcInterface";
import { RpcConfiguration } from "../core/RpcConfiguration";
import { RpcEndpoint, RpcMobilePlatform } from "../core/RpcConstants";
import { MobileRpcProtocol } from "./MobileRpcProtocol";
import { BackendIpc } from "../../ipc/BackendIpc";
import { FrontendIpc } from "../../ipc/FrontendIpc";
import { IpcWebSocketBackend, IpcWebSocketFrontend } from "../../ipc/IpcWebSocket";

/** Holds configuration for the RpcInterfaces used by the application.
 * @beta
 */
export abstract class MobileRpcConfiguration extends RpcConfiguration {
  /** @internal */
  public static setup = {
    obtainPort: () => 0,
    checkPlatform: () => typeof (process) !== "undefined" && (process.platform as any) === "ios",
  };

  public abstract protocol: MobileRpcProtocol;
  private static _args: any;
  private static getArgs(): any {
    if (typeof window !== "object" || typeof window.location !== "object" || typeof window.location.hash !== "string") {
      return Object.freeze({});
    }
    const queryArgs: any = {};
    try {
      const matches = window.location.hash.match(/([^#=&]+)(=([^&]*))?/g);
      if (matches) {
        for (const comp of matches) {
          const array = comp.split("=");
          if (array.length === 2) {
            const key = decodeURIComponent(array[0]);
            const val = decodeURIComponent(array[1]);
            queryArgs[key] = val;
          }
        }
      }
    } catch { }
    return Object.freeze(queryArgs);
  }
  private static getMobilePlatform(): RpcMobilePlatform {
    if (!MobileRpcConfiguration.args.platform)
      return RpcMobilePlatform.Unknown;

    const win: any = window;
    if (/android/i.test(MobileRpcConfiguration.args.platform)) {
      return RpcMobilePlatform.Android;
    }

    if (/iOS|iPadOS/i.test(MobileRpcConfiguration.args.platform) && !win.MSStream) {
      return RpcMobilePlatform.iOS;
    }

    return RpcMobilePlatform.Unknown;
  }
  /** Read the mobile rpc args */
  public static get args(): any {
    if (!this._args) {
      this._args = MobileRpcConfiguration.getArgs();
    }
    return this._args;
  }

  /** Return type of mobile platform using browser userAgent */
  public static get platform(): RpcMobilePlatform { return MobileRpcConfiguration.getMobilePlatform(); }

  /** Check if backend running on mobile */
  public static get isMobileBackend() { return typeof (process) !== "undefined" && (process.platform as any) === "ios"; }

  /** Check if frontend running on mobile */
  public static get isMobileFrontend() { return this.platform !== RpcMobilePlatform.Unknown; }

  /** Check if frontend running on wkwebview on ios */
  public static get isIOSFrontend() { return MobileRpcConfiguration.isMobileFrontend && (window as any).webkit && (window as any).webkit.messageHandlers; }
}

/** Coordinates usage of RPC interfaces for an Mobile-based application.
 * @beta
 */
export class MobileRpcManager {
  /** @internal */
  public static async ready() {
    return new Promise<void>(async (resolve) => {
      while (!(global as any).__imodeljsRpcReady) {
        await new Promise((r) => setTimeout(r));
      }

      resolve();
    });
  }

  private static performInitialization(interfaces: RpcInterfaceDefinition[], endPoint: RpcEndpoint): MobileRpcConfiguration {
    const config = class extends MobileRpcConfiguration {
      public interfaces = () => interfaces;
      public protocol: MobileRpcProtocol = new MobileRpcProtocol(this, endPoint);
    };

    for (const def of interfaces) {
      RpcConfiguration.assign(def, () => config);
    }

    const instance = RpcConfiguration.obtain(config);
    RpcConfiguration.initializeInterfaces(instance);

    return instance;
  }

  /** Initializes MobileRpcManager for the frontend of an application. */
  public static initializeClient(interfaces: RpcInterfaceDefinition[]): MobileRpcConfiguration {
    const config = MobileRpcManager.performInitialization(interfaces, RpcEndpoint.Frontend);
    FrontendIpc.initialize(new IpcWebSocketFrontend());
    return config;
  }
  /** Initializes MobileRpcManager for the backend of an application. */
  public static initializeImpl(interfaces: RpcInterfaceDefinition[]): MobileRpcConfiguration {
    const config = MobileRpcManager.performInitialization(interfaces, RpcEndpoint.Backend);
    BackendIpc.initialize(new IpcWebSocketBackend());
    return config;
  }
}
