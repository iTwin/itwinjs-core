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
import { interop, MobileRpcProtocol } from "./MobileRpcProtocol";
import { IModelError } from "../../IModelError";
import { BentleyStatus } from "@bentley/bentleyjs-core";
/** Holds configuration for the RpcInterfaces used by the application.
 * @beta
 */
export abstract class MobileRpcConfiguration extends RpcConfiguration {
  public abstract protocol: MobileRpcProtocol;
  private static getArgs(): any {
    if (typeof window === "undefined") {
      return {};
    }

    const queryArgs: any = {};
    const matches = window.location.hash.match(/([^#=&]+)(=([^&]*))?/g);
    if (matches) {
      for (const comp of matches) {
        const array = comp.split("=");
        if (array.length === 2) {
          const key = decodeURIComponent(array[0]);
          const val = decodeURIComponent(array[1]);
          queryArgs[key] = val;
        } else {
          throw new IModelError(BentleyStatus.ERROR, "Unexpected parameters");
        }
      }
    }
    return queryArgs;
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
  public static readonly args: any = MobileRpcConfiguration.getArgs();

  /** Return type of mobile platform using browser userAgent */
  public static readonly platform: RpcMobilePlatform = MobileRpcConfiguration.getMobilePlatform();

  /** Check if running backend running on mobile */
  public static get isMobileBackend() { return interop !== null; }

  /** Check if running backend running on mobile */
  public static get isMobileFrontend() { return this.platform !== RpcMobilePlatform.Unknown; }

  /** Check if running backend running on wkwebview on ios */
  public static get isIOSFrontend() { return MobileRpcConfiguration.isMobileFrontend && (window as any).webkit && (window as any).webkit.messageHandlers; }
}

/** Coordinates usage of RPC interfaces for an Mobile-based application.
 * @beta
 */
export class MobileRpcManager {
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
    return MobileRpcManager.performInitialization(interfaces, RpcEndpoint.Frontend);
  }
  /** Initializes MobileRpcManager for the backend of an application. */
  public static initializeImpl(interfaces: RpcInterfaceDefinition[]): MobileRpcConfiguration {
    return MobileRpcManager.performInitialization(interfaces, RpcEndpoint.Backend);
  }
}
