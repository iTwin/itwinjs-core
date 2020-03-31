/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Extensions
 */
import * as semver from "semver";
import { I18N, I18NOptions } from "@bentley/imodeljs-i18n";
import { AuthorizedClientRequestContext } from "@bentley/imodeljs-clients";
import { ExtensionClient, ExtensionProps } from "@bentley/extension-client";

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

/** Reads the extension from a plain server assuming that the extension is a set of files in a directory formatted as "imjs_extensions/<extensionName>".
 * @beta
 */
export class ExternalServerExtensionLoader implements ExtensionLoader {
  public constructor(public serverName: string) { }

  public resolveResourceUrl(extensionName: string, relativeUrl: string): string {
    const relativeUrlWithSlash = relativeUrl.startsWith("/") ? relativeUrl : ("/" + relativeUrl);
    return new URL("imjs_extensions/".concat(extensionName, relativeUrlWithSlash), this.serverName).toString();
  }

  public getExtensionName(extensionRoot: string): string {
    const slashPos = extensionRoot.lastIndexOf("/");
    return extensionRoot.slice(slashPos + 1);
  }

  public async loadExtension(extensionName: string, _extensionVersion?: string, args?: string[]): Promise<PendingExtension | undefined> {
    // TODO: The entry point must be a "index.js" file at this point and no need for a manifest file.  All version checking is done in the Extensions bundle (i.e. "index.js")
    const jsFileUrl: string = this.resolveResourceUrl(extensionName, "/index.js");

    // check if the entry point exists
    const response = await fetch(jsFileUrl, { method: "HEAD" });
    if (response.status !== 200)
      return undefined;

    // set it up to load.
    return new PendingExtension(jsFileUrl, this, args);
  }
}

interface LoadedExtensionProps {
  props: ExtensionProps;
  basePath: string;
}

/** Downloads extensions from Extension Service
 * @beta
 */
export class ExtensionServiceExtensionLoader implements ExtensionLoader {
  private _loadedExtensionProps: { [extensionName: string]: LoadedExtensionProps } = {};

  public constructor(private _contextId: string) { }

  public resolveResourceUrl(extensionName: string, relativeFileName: string): string {
    const loadedProps = this._loadedExtensionProps[extensionName];
    if (loadedProps === undefined) {
      throw new Error("Extension with given name hasn't been loaded");
    }

    const fullFileName = new URL(relativeFileName, loadedProps.basePath).toString();
    const fileNameWithKey = loadedProps.props.uri.find((uri) => uri.startsWith(fullFileName));

    return fileNameWithKey ?? fullFileName;
  }

  public getExtensionName(extensionRoot: string): string {
    return extensionRoot;
  }

  public async loadExtension(extensionName: string, extensionVersion?: string, args?: string[] | undefined): Promise<PendingExtension | undefined> {
    const loadedExtensionProps = await this.getExtensionProps(extensionName, extensionVersion);
    if (loadedExtensionProps === undefined)
      return undefined;

    this._loadedExtensionProps[extensionName] = loadedExtensionProps;

    const mainFilePath = new URL("index.js", loadedExtensionProps.basePath).toString();
    const mainFileUrl = loadedExtensionProps.props.uri.find((uri) => uri.startsWith(mainFilePath));
    if (mainFileUrl === undefined)
      return undefined;

    return new PendingExtension(mainFileUrl, this, args);
  }

  private async getExtensionProps(extensionName: string, extensionVersion?: string): Promise<LoadedExtensionProps | undefined> {
    const extensionClient = new ExtensionClient();

    const accessToken = await IModelApp.authorizationClient!.getAccessToken();
    if (!accessToken)
      return undefined;
    const requestContext = new AuthorizedClientRequestContext(accessToken);

    let extensionProps: ExtensionProps | undefined;
    if (extensionVersion !== undefined)
      extensionProps = await extensionClient.getExtensionProps(requestContext, this._contextId, extensionName, extensionVersion);
    else {
      const props = await extensionClient.getExtensions(requestContext, this._contextId, extensionName);
      const newestVersion = semver.rsort(props.map((ext) => ext.version))[0];
      extensionProps = props.find((ext) => ext.version === newestVersion);
    }

    if (extensionProps === undefined)
      return undefined;

    const sortedUris = extensionProps.uri.sort();
    const firstUri = sortedUris[0];
    const lastUri = sortedUris[sortedUris.length - 1];
    let i = 0;
    while (i < firstUri.length && firstUri[i] === lastUri[i]) i++;
    while (i > 0 && firstUri[i] !== "/") i--;
    const relativePathStart = i + 1;
    const basePath = firstUri.slice(0, relativePathStart);

    return { props: extensionProps, basePath };
  }
}
