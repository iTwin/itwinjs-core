/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Extensions
 */
import { I18N, I18NOptions } from "@bentley/imodeljs-i18n";
import { ExtensionProps } from "@bentley/extension-client";

import { IModelApp } from "../IModelApp";
import { ExtensionLoadResults } from "./ExtensionResults";

/**
 * @internal
 */
export const loggerCategory = "imodeljs-frontend.Extension";

type resolveFunc = ((arg: any) => void);
type rejectFunc = ((arg: Error) => void);

/** Implement this interface, then register it using IModelApp.extensionAdmin.addExtensionLoader to load extensions from a different source.
 * @beta
 */
export interface ExtensionLoader {
  // get extension name from extension root string
  getExtensionName(extensionRoot: string): string;
  // load the extension javascript from the tar file.
  loadExtension(extensionName: string, extensionVersion?: string, args?: string[]): Promise<PendingExtension | undefined>;
  // resolve resource url given a relative path
  resolveResourceUrl(extensionName: string, relativeFileName: string): string;
}

/**
 * Base Extension class for writing a demand-loaded module.
 * @see [[ExtensionAdmin]] for a description of how Extensions are loaded.
 * @see [Extensions]($docs/learning/frontend/extensions.md)
 * @beta
 */
export abstract class Extension {
  /** Constructor for base Extension class
   * @param name - the name of the extension.
   * @note Typically, an Extension subclass is instantiated and registered with top-level JavaScript statements like these:
   * ```ts
   *  const myExtension = new MyExtension(EXTENSION_NAME);
   *  IModelApp.extensionAdmin.register(myExtension);
   * ```
   */
  public constructor(public name: string) { }

  // returns an instance of I18N that can be reliably called from the Extension.
  private getI18n(): I18N {
    return new I18N("noDefaultNs", {
      urlTemplate: (lng: string[], ns: string[]) => {
        if (lng.length < 1 || ns.length < 1)
          throw new Error("No language info provided");
        return this.resolveResourceUrl("locales".concat("/", lng[0], "/", ns[0], ".json"));
      },
    });
  }

  /** Method called when the Extension is first loaded.
   * @param _args arguments that were passed to [ExtensionAdmin.loadExtension]($frontend). The first argument is the extension name.
   */
  public onLoad(_args: string[]): void {
  }

  /** Method called immediately following the call to onLoad when the Extension is first loaded, and also once for
   * each additional call to [ExtensionAdmin.loadExtension]($frontend) for the same Extension.
   * @param _args arguments that were passed to [ExtensionAdmin.loadExtension]($frontend). The first argument is the extension name.
   */
  public abstract onExecute(_args: string[]): void;

  private _loader: ExtensionLoader | undefined;
  /** @internal */
  public get loader(): ExtensionLoader | undefined { return this._loader; }
  public set loader(loader: ExtensionLoader | undefined) {
    this._loader = loader;
  }

  /** Returns a fully qualified resource URL which is needed when the extension is loaded from an external server
   * @param relativeUrl the url relative to the location specified for the Extension URL.
   */
  public resolveResourceUrl(relativeUrl: string): string {
    if (this._loader === undefined)
      throw new Error("The register method must be called prior to using the resolveResourceUrl method of Extension.");
    return this._loader.resolveResourceUrl(this.name, relativeUrl);
  }

  private _i18n: I18N | undefined;

  /** Property that retrieves the localization instance specific to the Extension. */
  public get i18n(): I18N {
    if (this._i18n)
      return this._i18n;

    if (this._loader === undefined)
      throw new Error("The register method must be called prior to using the i18n member of Extension.");

    return (this._i18n = this.getI18n());
  }

  /** Can be used to set up a localization instance. Used only if non-standard treatment is required.
   * @param defaultNamespace
   * @param options
   */
  public setI18n(defaultNamespace?: string, options?: I18NOptions) {
    this._i18n = new I18N(defaultNamespace, options);
  }

  /** When a Extension has been loaded, and there is a subsequent call to load the same Extension,
   * returning false from this method prevents the system from reporting the reload.
   */
  public reportReload(): boolean {
    return true;
  }
}

/** Represents an Extension that we are attempting to load.
 * @beta
 */
export class PendingExtension {
  public resolve: resolveFunc | undefined = undefined;
  public reject: rejectFunc | undefined = undefined;
  public promise: Promise<ExtensionLoadResults>;

  public constructor(private _tarFileUrl: string, public loader: ExtensionLoader, public args?: string[]) {
    this.promise = new Promise(this.executor.bind(this));
  }

  public executor(resolve: resolveFunc, reject: rejectFunc) {
    this.resolve = resolve;
    this.reject = reject;

    const head = document.getElementsByTagName("head")[0];
    if (!head)
      reject(new Error("no head element found"));

    // create the script element. We handle onerror and resolve a ExtensionLoadResult failure in the onerror handler,
    // but we don't resolve success until the loaded extension calls "register" (see Extension.register)
    const scriptElement = document.createElement("script");

    scriptElement.onerror = this.cantLoad.bind(this);

    scriptElement.async = true;
    scriptElement.src = this._tarFileUrl;
    head.insertBefore(scriptElement, head.lastChild);
  }

  // called when we can't load the URL
  private cantLoad(_ev: string | Event) {
    this.resolve!(IModelApp.i18n.translate("iModelJs:ExtensionErrors.CantFind", { extensionUrl: this._tarFileUrl }));
  }
}

/**
 * @internal
 */
export interface LoadedExtensionProps {
  props: ExtensionProps;
  basePath: string;
}
