/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @internal */
export class MobileUtils {
  public static get isITwinFrontend() {
    return (typeof window === "object" && typeof window.navigator === "object") && undefined !== (window as any).itwin;
  }
  public static get isITwinBackend() {
    return typeof (process) !== "undefined" && (undefined !== process.platform);
  }
  public static get isIOSFrontend() {
    return this.isITwinFrontend && /(iphone|ipod|ipad)/i.test(window.navigator.userAgent);
  }
  public static get isAndroidFrontend() {
    return this.isITwinFrontend && /android/i.test(window.navigator.userAgent);
  }
  public static get isIpadFrontend() {
    return this.isITwinFrontend && window.navigator.platform === "iPad" || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 0 && !window.MSStream);
  }
  public static get isIOSBackend() {
    return this.isITwinBackend && (process.platform as any) === "ios";
  }
  public static get isAndroidBackend() {
    return this.isITwinBackend && (process.platform as any) === "android";
  }
  /**  Set to true if the process is running in a mobile app frontend */
  public static get isMobileFrontend() {
    return this.isIOSFrontend || this.isAndroidFrontend || this.isIpadFrontend;
  }
  /**
   * Set to true if the process is running in a mobile app backend
   * TODO: Verify that android case works
   */
  public static get isMobileBackend() {
    return this.isIOSBackend || this.isAndroidBackend;
  }
}
