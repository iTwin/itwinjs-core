/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module NativeApp
 */

import { BeEvent } from "@bentley/bentleyjs-core";
export enum Orientation {
  Unknown = 0,
  Portrait = 0x1,
  PortraitUpsideDown = 0x2,
  LandscapeLeft = 0x4,
  LandscapeRight = 0x8,
  FaceUp = 0x10,
  FaceDown = 0x20,
}

export enum BatteryState {
  Unknown = 0,
  Unplugged = 1,
  Charging = 2,
  Full = 3,
}
export enum DeviceEvents {
  MemoryWarning = "memoryWarning",
  OrientationChanged = "orientationChanged",
  EnterForground = "enterForground",
  EnterBackground = "enterBackground",
  WillTerminate = "willTerminate",
}

export interface DeviceRpc {
  emit(eventName: DeviceEvents, ...args: any[]): void;
  getOrientation?: () => Orientation;
  getBatteryState?: () => BatteryState;
  getBatteryLevel?: () => number;
  downloadFile?: (url: string, callback: (downloadFileUrl?: string, err?: string) => void) => void;
  reconnect?: (connection: number) => void;
}

export class Device implements DeviceRpc {
  private constructor() { }
  public readonly onMemoryWarning = new BeEvent();
  public readonly onOrientationChanged = new BeEvent();
  public readonly onEnterForground = new BeEvent();
  public readonly onEnterBackground = new BeEvent();
  public readonly onWillTerminate = new BeEvent();
  public emit(eventName: DeviceEvents, ...args: any[]) {
    switch (eventName) {
      case DeviceEvents.MemoryWarning:
        this.onMemoryWarning.raiseEvent(...args); break;
      case DeviceEvents.OrientationChanged:
        this.onOrientationChanged.raiseEvent(...args); break;
      case DeviceEvents.EnterForground:
        this.onEnterForground.raiseEvent(...args); break;
      case DeviceEvents.EnterBackground:
        this.onEnterBackground.raiseEvent(...args); break;
      case DeviceEvents.WillTerminate:
        this.onWillTerminate.raiseEvent(...args); break;
    }
  }
  public static readonly currentDevice = new Device();
}

(global as any)[Symbol("device")] = Device.currentDevice;
