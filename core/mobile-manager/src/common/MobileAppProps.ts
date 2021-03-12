/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @internal */
export const mobileAppChannel = "mobileApp";
/** @internal */
export const mobileAppNotify = "mobileApp-notify";

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

export interface MobileNotifications {
  notifyMemoryWarning: () => void;
  notifyOrientationChanged: () => void;
  notifyEnterForeground: () => void;
  notifyEnterBackground: () => void;
  notifyWillTerminate: () => void;
}

export type DeviceEvents = "memoryWarning" | "orientationChanged" | "enterForeground" | "enterBackground" | "willTerminate";

/**
* The methods that may be invoked via Ipc from the frontend of a Mobile App that are implemented on its backend.
* @internal
*/
export interface MobileAppFunctions {
  reconnect: (connection: number) => Promise<void>;
}
