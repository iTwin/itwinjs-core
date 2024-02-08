/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Localization
 */

import i18next, { i18n, InitOptions, Module, TOptionsBase } from "i18next";
import i18nextBrowserLanguageDetector, { DetectorOptions } from "i18next-browser-languagedetector";
import backend, { BackendOptions } from "i18next-http-backend";
import { Logger } from "@itwin/core-bentley";
import type { Localization } from "@itwin/core-common";

const DEFAULT_MAX_RETRIES: number = 1; // a low number prevents wasted time and potential timeouts when requesting localization files throws an error

/** Options for ITwinLocalization
 *  @public
 */
export interface LocalizationOptions {
  urlTemplate?: string;
  backendPlugin?: Module;
  detectorPlugin?: Module;
  initOptions?: InitOptions;
  backendHttpOptions?: BackendOptions;
  detectorOptions?: DetectorOptions;
}

/** Supplies localizations for iTwin.js
 * @note this class uses the [i18next](https://www.i18next.com/) package.
 * @public
 */
export class ITwinLocalization implements Localization {
  public i18next: i18n;
  private readonly _initOptions: InitOptions;
  private readonly _backendOptions: BackendOptions;
  private readonly _detectionOptions: DetectorOptions;
  private readonly _namespaces = new Map<string, Promise<void>>();

  public constructor(options?: LocalizationOptions) {
    this.i18next = i18next.createInstance();

    this._backendOptions = {
      loadPath: options?.urlTemplate ?? "locales/{{lng}}/{{ns}}.json",
      crossDomain: true,
      ...options?.backendHttpOptions,
    };

    this._detectionOptions = {
      order: ["querystring", "navigator", "htmlTag"],
      lookupQuerystring: "lng",
      caches: [],
      ...options?.detectorOptions,
    };

    this._initOptions = {
      interpolation: { escapeValue: true },
      fallbackLng: "en",
      maxRetries: DEFAULT_MAX_RETRIES,
      backend: this._backendOptions,
      detection: this._detectionOptions,
      ...options?.initOptions,
    };

    this.i18next
      .use(options?.detectorPlugin ?? i18nextBrowserLanguageDetector)
      .use(options?.backendPlugin ?? backend)
      .use(TranslationLogger);
  }

  public async initialize(namespaces: string[]): Promise<void> {

    // Also consider namespaces passed into constructor
    const initNamespaces: string[] = [this._initOptions.ns || []].flat();
    const combinedNamespaces: Set<string> = new Set([...namespaces, ...initNamespaces]); // without duplicates

    const defaultNamespace: string | false | readonly string[] = this._initOptions.defaultNS ?? namespaces[0];
    if (defaultNamespace)
      combinedNamespaces.add(defaultNamespace as string); // Make sure default namespace is in namespaces list

    const initOptions: InitOptions = {
      ...this._initOptions,
      defaultNS: defaultNamespace,
      ns: [...combinedNamespaces],
    };

    // if in a development environment, set debugging
    if (process.env.NODE_ENV === "development")
      initOptions.debug = true;

    const initPromise = this.i18next.init(initOptions) as unknown as Promise<void>;

    for (const ns of namespaces)
      this._namespaces.set(ns, initPromise);

    return initPromise;
  }

  /** Replace all instances of `%{key}` within a string with the translations of those keys.
   * For example:
   * ``` ts
   * "MyKeys": {
   *   "Key1": "First value",
   *   "Key2": "Second value"
   *  }
   * ```
   *
   * ``` ts
   * i18.translateKeys("string with %{MyKeys.Key1} followed by %{MyKeys.Key2}!"") // returns "string with First Value followed by Second Value!"
   * ```
   * @param line The input line, potentially containing %{keys}.
   * @returns The line with all %{keys} translated
   * @public
   */
  public getLocalizedKeys(line: string): string {
    return line.replace(/\%\{(.+?)\}/g, (_match, tag) => this.getLocalizedString(tag));
  }

  /** Return the translated value of a key.
   * @param key - the key that matches a property in the JSON localization file.
   * @note The key includes the namespace, which identifies the particular localization file that contains the property,
   * followed by a colon, followed by the property in the JSON file.
   * For example:
   * ``` ts
   * const dataString: string = IModelApp.localization.getLocalizedString("iModelJs:BackgroundMap.BingDataAttribution");
   *  ```
   * assigns to dataString the string with property BackgroundMap.BingDataAttribution from the iModelJs.json localization file.
   * @returns The string corresponding to the first key that resolves.
   * @throws Error if no keys resolve to a string.
   * @public
   */
  public getLocalizedString(key: string | string[], options?: TOptionsBase): string {
    if (options?.returnDetails || options?.returnObjects) {
      throw new Error("Translation key must map to a string, but the given options will result in an object");
    }

    const value = this.i18next.t(key, options);

    if (typeof value !== "string") {
      throw new Error("Translation key(s) string not found");
    }

    return value;
  }

  /** Similar to `getLocalizedString` but the default namespace is a separate parameter and the key does not need
   * to include a namespace. If a key includes a namespace, that namespace will be used for interpolating that key.
   * @param namespace - the namespace that identifies the particular localization file that contains the property.
   * @param key - the key that matches a property in the JSON localization file.
   * @returns The string corresponding to the first key that resolves.
   * @throws Error if no keys resolve to a string.
   * @internal
   */
  public getLocalizedStringWithNamespace(namespace: string, key: string | string[], options?: TOptionsBase): string {
    let fullKey: string | string[] = "";

    if (typeof key === "string") {
      fullKey = `${namespace}:${key}`;
    } else {
      fullKey = key.map((subKey: string) => {
        return `${namespace}:${subKey}`;
      });
    }

    return this.getLocalizedString(fullKey, options);
  }

  /** Gets the English translation.
   * @param namespace - the namespace that identifies the particular localization file that contains the property.
   * @param key - the key that matches a property in the JSON localization file.
   * @returns The string corresponding to the first key that resolves.
   * @throws Error if no keys resolve to a string.
   * @internal
   */
  public getEnglishString(namespace: string, key: string | string[], options?: TOptionsBase): string {
    if (options?.returnDetails || options?.returnObjects) {
      throw new Error("Translation key must map to a string, but the given options will result in an object");
    }

    options = {
      ...options,
      ns: namespace, // ensure namespace argument is used
    };

    const en = this.i18next.getFixedT("en", namespace);
    const str = en(key, options);
    if (typeof str !== "string")
      throw new Error("Translation key(s) not found");

    return str;
  }

  /** Get the promise for an already registered Namespace.
   * @param name - the name of the namespace
   * @public
   */
  public getNamespacePromise(name: string): Promise<void> | undefined {
    return this._namespaces.get(name);
  }

  /** @internal */
  public getLanguageList(): readonly string[] {
    return this.i18next.languages;
  }

  /** override the language detected in the browser  */
  public async changeLanguage(language: string) {
    return this.i18next.changeLanguage(language) as unknown as Promise<void>;
  }

  /** Register a new Namespace and return it. If the namespace is already registered, it will be returned.
   * @param name - the name of the namespace, which is the base name of the JSON file that contains the localization properties.
   * @note - The registerNamespace method starts fetching the appropriate version of the JSON localization file from the server,
   * based on the current locale. To make sure that fetch is complete before performing translations from this namespace, await
   * fulfillment of the readPromise Promise property of the returned LocalizationNamespace.
   * @see [Localization in iTwin.js]($docs/learning/frontend/Localization.md)
   * @public
   */
  public async registerNamespace(name: string): Promise<void> {
    const existing = this._namespaces.get(name);
    if (existing !== undefined)
      return existing;

    const theReadPromise = new Promise<void>((resolve) => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.i18next.loadNamespaces(name, (err) => {
        if (!err)
          return resolve();

        // Here we got a non-null err object.
        // This method is called when the system has attempted to load the resources for the namespaces for each possible locale.
        // For example 'fr-ca' might be the most specific locale, in which case 'fr' and 'en' are fallback locales.
        // Using Backend from i18next-http-backend, err will be an array of strings of each namespace it tried to read and its locale.
        // There might be errs for some other namespaces as well as this one. We resolve the promise unless there's an error for each possible locale.
        let locales = this.getLanguageList().map((thisLocale: any) => `/${thisLocale}/`);

        try {
          for (const thisError of err) {
            if (typeof thisError === "string")
              locales = locales.filter((thisLocale) => !thisError.includes(thisLocale));
          }
        } catch (e) {
          locales = [];
        }
        // if we removed every locale from the array, it wasn't loaded.
        if (locales.length === 0)
          Logger.logError("i18n", `No resources for namespace ${name} could be loaded`);

        resolve();
      });
    });
    this._namespaces.set(name, theReadPromise);
    return theReadPromise;
  }

  /** @internal */
  public unregisterNamespace(name: string): void {
    this._namespaces.delete(name);
  }
}

class TranslationLogger {
  public static readonly type = "logger";
  public log(args: string[]) { Logger.logInfo("i18n", this.createLogMessage(args)); }
  public warn(args: string[]) { Logger.logWarning("i18n", this.createLogMessage(args)); }
  public error(args: string[]) { Logger.logError("i18n", this.createLogMessage(args)); }
  private createLogMessage(args: string[]) {
    let message = args[0];
    for (let i = 1; i < args.length; ++i) {
      if (typeof args[i] === "string")
        message += `\n  ${args[i]}`;
    }
    return message;
  }
}
