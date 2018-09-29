/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { RpcInterfaceDefinition } from "../../RpcInterface";
import { RpcConfiguration } from "../core/RpcConfiguration";
import { MobileRpcProtocol, EndPoint, interop } from "./MobileRpcProtocol";

/** Mobile platform */
export enum MobilePlatform {
  Unknown,
  Window, // Window Phone
  Android, // Android OS
  iOS, // iOS platform
}
/** Holds configuration for the RpcInterfaces used by the application. */
export abstract class MobileRpcConfiguration extends RpcConfiguration {
  public abstract protocol: MobileRpcProtocol;
  private static getMobilePlaform(): MobilePlatform {
    if (typeof window === "undefined") {
      return MobilePlatform.Unknown;
    }

    const win: any = window;
    const userAgent = win.navigator.userAgent || win.navigator.vendor || win.opera;
    if (/windows phone/i.test(userAgent)) {
      return MobilePlatform.Window;
    }

    if (/android/i.test(userAgent)) {
      return MobilePlatform.Android;
    }

    if (/iPad|iPhone|iPod/.test(userAgent) && !win.MSStream) {
      return MobilePlatform.iOS;
    }

    return MobilePlatform.Unknown;
  }

  /** Return type of mobile platform using browser userAgent */
  public static readonly platform: MobilePlatform = MobileRpcConfiguration.getMobilePlaform();

  /** Check if running backend running on mobile */
  public static get isMobileBackend() { return interop !== null; }

  /** Check if running backend running on mobile */
  public static get isMobileFrontend() { return MobileRpcConfiguration.platform !== MobilePlatform.Unknown; }

}

/** Coordinates usage of RPC interfaces for an Mobile-based application. */
export class MobileRpcManager {
  private static performInitialization(interfaces: RpcInterfaceDefinition[], endPoint: EndPoint): MobileRpcConfiguration {
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
    return MobileRpcManager.performInitialization(interfaces, EndPoint.Frontend);
  }
  /** Initializes MobileRpcManager for the backend of an application. */
  public static initializeImpl(interfaces: RpcInterfaceDefinition[]): MobileRpcConfiguration {
    return MobileRpcManager.performInitialization(interfaces, EndPoint.Backend);
  }
}
