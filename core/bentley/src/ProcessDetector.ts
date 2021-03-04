/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ProcessDetector
 */

// Portions modified from package 'detect-gpu': https://github.com/TimvanScherpenzeel/detect-gpu/blob/master/src/index.ts

/** Functions to determine the type of JavaScript process currently executing
 * @beta
 */
export class ProcessDetector {

  /** Is this a browser process?
   * @note this method will also return `true` for the frontend of Electron or Mobile apps. They *are* browser processes.
   */
  public static get isBrowserProcess() { return typeof window === "object" && typeof window.navigator === "object"; }

  /** Is this a Node process?
   * @note this means "is this a backend process"? It will return `true` for all backend process, including Electron and mobile apps.
  */
  public static get isNodeProcess() { return typeof process === "object" && undefined !== process.platform; }

  /** Is this process the frontend of an Electron app? */
  public static get isElectronAppFrontend() { return typeof navigator === "object" && navigator.userAgent.toLowerCase().indexOf("electron") >= 0; }

  /** Is this process the backend of an Electron app? */
  public static get isElectronAppBackend() { return typeof process === "object" && process.versions.hasOwnProperty("electron"); }

  /** Is this process running in a browser on an iPad?
   * @note This method will return `true` for any frontend running on an iPad, whether it is a user-launched web browser (e.g. Safari) or the frontend of a mobile app.
   */
  public static get isIPadBrowser() {
    return this.isBrowserProcess && window.navigator.platform === "iPad" || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 0 && !window.MSStream);
  }

  /** Is this process running in a browser on an iPhone?
   * @note This method will return `true` for any frontend running on an iPhone, whether it is a user-launched web browser (e.g. Safari) or the frontend of a mobile app.
   */
  public static get isIPhoneBrowser() { return this.isBrowserProcess && (/(iphone|ipod)/i.test(window.navigator.userAgent)); }

  /** Is this process running in a browser on an iOS device?
   * @note This method will return `true` for any frontend running on an iOS device, whether it is a user-launched web browser (e.g. Safari) or the frontend of a mobile app.
  */
  public static get isIOSBrowser() { return this.isIPadBrowser || this.isIPhoneBrowser; }

  /** Is this process running in a browser on an Android device?
   * @note This method will return `true` for any frontend running on an Android device, whether it is a user-launched web browser (e.g. Chrome) or the frontend of a mobile app.
  */
  public static get isAndroidBrowser() { return this.isBrowserProcess && /android/i.test(window.navigator.userAgent); }

  /** Is this process running in a browser on a mobile device?
   * @note This method will return `true` for any frontend running on a mobile device, whether it is a user-launched web browser or the frontend of a mobile app.
  */
  public static get isMobileBrowser() { return this.isIOSBrowser || this.isAndroidBrowser; }

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
