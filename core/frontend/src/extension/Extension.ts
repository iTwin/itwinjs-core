/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Extensions
 */

type ResolveFunc = (() => Promise<any>);

/** Defines the format of an Extension manifest  */
export interface ExtensionManifest {
  readonly name: string;
  readonly displayName?: string;
  readonly version: string;
  readonly description?: string;
  /** The main module file to load. This should be a path to the javascript file
   * e.g "./lib/main.js"
   */
  readonly main?: string;
  /** The version of iTwin.js Core. */
  readonly engines?: { itwinjs: string };
  /** List of activation events this Extension supports. */
  readonly activationEvents?: string[];
  readonly enableProposedApi?: boolean;
}

export interface BuildExtensionManifest extends ExtensionManifest {
  /** Only valid when the Extension is loaded at build-time.
   *
   * Defines how to load the Extension manifest and
   */
  readonly module?: string;
}

/** Describes an Extension that has already been downloaded and has a location files can be easily executed. */
export interface LocalExtensionProps {
  readonly manifest: ExtensionManifest;
  readonly mainFunc?: ResolveFunc;
  /** Identifies a location of the Extension that it can be loaded.
   *
   * WIP:
   *  - Could be a URL to the location of the Extension
   *  - Could be a file path to an installed location locally.
   */
  // readonly location: string;
}

/** Represents an Extension that we are attempting to load.
  * @beta
  */
// export class PendingExtension {
//   public resolve: ResolveFunc | undefined = undefined;
//   public reject: RejectFunc | undefined = undefined;
//   public promise: Promise<LocalExtensionProps>;

//   public constructor(private _tarFileUrl: string, public loader: ExtensionLoader, public args?: string[]) {
//     this.promise = new Promise(this.executor.bind(this));
//   }

//   public executor(resolve: ResolveFunc, reject: RejectFunc) {
//     this.resolve = resolve;
//     this.reject = reject;

//     const head = document.getElementsByTagName("head")[0];
//     if (!head)
//       reject(new Error("no head element found"));

//     // create the script element. We handle onerror and resolve a ExtensionLoadResult failure in the onerror handler,
//     // but we don't resolve success until the loaded extension calls "register" (see Extension.register)
//     const scriptElement = document.createElement("script");

//     scriptElement.onerror = this.cantLoad.bind(this);

//     scriptElement.async = true;
//     scriptElement.src = this._tarFileUrl;
//     head.insertBefore(scriptElement, head.lastChild);
//   }

//   // called when we can't load the URL
//   private cantLoad(_ev: string | Event) {
//     this.resolve!(IModelApp.i18n.translate("iModelJs:ExtensionErrors.CantFind", { extensionUrl: this._tarFileUrl }));
//   }
// }
