/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { AccessToken } from "@itwin/core-bentley";

/** @beta */
export enum Orientation {
  Unknown = 0,
  Portrait = 0x1,
  PortraitUpsideDown = 0x2,
  LandscapeLeft = 0x4,
  LandscapeRight = 0x8,
  FaceUp = 0x10,
  FaceDown = 0x20,
}

/** @beta */
export enum BatteryState {
  Unknown = 0,
  Unplugged = 1,
  Charging = 2,
  Full = 3,
}

/** @beta */
export interface MobileNotifications {
  notifyMemoryWarning: () => void;
  notifyOrientationChanged: () => void;
  notifyEnterForeground: () => void;
  notifyEnterBackground: () => void;
  notifyWillTerminate: () => void;
  notifyAuthAccessTokenChanged: (accessToken: string | undefined, expirationDate: string | undefined) => void;
}

/** @beta */
export type DeviceEvents = "memoryWarning" | "orientationChanged" | "enterForeground" | "enterBackground" | "willTerminate" | "authAccessTokenChanged";

/**
* The methods that may be invoked via Ipc from the frontend of a Mobile App that are implemented on its backend.
* @beta
*/
export interface MobileAppFunctions {
  reconnect: (connection: number) => Promise<void>;
  getAccessToken: () => Promise<[AccessToken, string]>;
}
