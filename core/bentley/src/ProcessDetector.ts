/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** Functions to determine the type of JavaScript process currently executing
 * @beta
 */
export class ProcessDetector {
  /** Is this a browser process? */
  public static get isBrowserProcess() { return typeof window === "object" && typeof window.navigator === "object"; }

  /** Is this a Node process? */
  public static get isNodeProcess() { return typeof process === "object" && undefined !== process.platform; }

  /** Is this process the frontend of an electron app? */
  public static get isElectronAppFrontend() { return typeof navigator === "object" && navigator.userAgent.toLowerCase().indexOf("electron") >= 0; }

  /** Is this process the backend of an electron app? */
  public static get isElectronAppBackend() { return typeof process === "object" && process.versions.hasOwnProperty("electron"); }

  /** Is this process running in a browser on an iOS device? */
  public static get isIOSBrowser() { return this.isBrowserProcess && /(iphone|ipod|ipad)/i.test(window.navigator.userAgent); }

  /** Is this process running in a browser on an iPad? */
  public static get isIpadBrowser() {
    return this.isBrowserProcess && window.navigator.platform === "iPad" || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 0 && !window.MSStream);
  }

  /** Is this process running in a browser on an Android device? */
  public static get isAndroidBrowser() { return this.isBrowserProcess && /android/i.test(window.navigator.userAgent); }

  /** Is this process running in a browser on a mobile device? */
  public static get isMobileBrowser() { return this.isIOSBrowser || this.isAndroidBrowser || this.isIpadBrowser; }

  /** Is this process the frontend of an iTwin mobile application?
   * @note this indicates that this is a browser process started by an iTwin mobile application.
   * It will return `false` when running user-launched web browsers on a mobile device.
   */
  public static get isMobileAppFrontend() { return this.isBrowserProcess && window.location.origin === "imodeljs://app"; }

  /** Is this process the frontend of an iOS mobile application? */
  public static get isIOSAppFrontend() { return this.isMobileAppFrontend && window.location.hash.indexOf("platform=ios") !== -1; }

  /** Is this process the frontend of an Android mobile application? */
  public static get isAndroidAppFrontend() { return this.isMobileAppFrontend && window.location.hash.indexOf("platform=android") !== -1; }

  /** Is this process the backend of an iOS mobile application? */
  public static get isIOSAppBackend() { return this.isNodeProcess && (process.platform as any) === "ios"; }

  /** Is this process the backend of an Android mobile application? */
  public static get isAndroidAppBackend() { return this.isNodeProcess && (process.platform as any) === "android"; }

  /**  Is this process a mobile app backend? */
  public static get isMobileAppBackend() { return this.isIOSAppBackend || this.isAndroidAppBackend; }
}
