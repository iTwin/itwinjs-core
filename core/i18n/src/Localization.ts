/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Localization
 */

import { createInstance, i18n, InitOptions, TranslationOptions } from "i18next";
import * as i18nextBrowserLanguageDetector from "i18next-browser-languagedetector";
import * as HttpApi from "i18next-http-backend";
import { Logger } from "@itwin/core-bentley";
import { Localization } from "@itwin/core-common";

/** Options for ITwinLocalization
 *  @public
 */
export interface LocalizationOptions {
  urlTemplate: string;
}

/** Supplies localizations for iTwin.js
 * @note Internally, this class uses the [i18next](https://www.i18next.com/) package.
 * @public
 */
export class ITwinLocalization implements Localization {
  private _i18next: i18n;
  private readonly _namespaceRegistry = new Map<string, Promise<void>>();

  /**
   * @param options object with I18NOptions (optional)
   */
  public constructor(options?: LocalizationOptions) {
    this._i18next = createInstance();

    const backend: HttpApi.BackendOptions = {
      loadPath: options?.urlTemplate ?? "locales/{{lng}}/{{ns}}.json",
      crossDomain: true,
    };

    const detection: i18nextBrowserLanguageDetector.DetectorOptions = {
      order: ["querystring", "navigator", "htmlTag"],
      lookupQuerystring: "lng",
      caches: [],
    };

    const initOptions: InitOptions = {
      interpolation: { escapeValue: true },
      ns: [],
      defaultNS: "",
      fallbackLng: "en",
      backend,
      detection,
    };

    // if in a development environment, set debugging
    if (process.env.NODE_ENV === "development")
      initOptions.debug = true;

    this._i18next.use(i18nextBrowserLanguageDetector)
      .use(HttpApi.default ?? HttpApi)
      .use(TranslationLogger)
      .init(initOptions);
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
  public getLocalizedString(key: string | string[], options?: TranslationOptions): string {
    const value = this._i18next.t(key, options);
    if (typeof value !== "string")
      throw new Error("Translation key(s) not found");

    return value;
  }

  /** Similar to 'translate()' but the namespace is a separate param and the key does not include the namespace.
   * @param namespace - the namespace that identifies the particular localization file that contains the property.
   * @param key - the key that matches a property in the JSON localization file.
   * @returns The string corresponding to the first key that resolves.
   * @throws Error if no keys resolve to a string.
   * @internal
   */
  public getLocalizedStringWithNamespace(namespace: string, key: string | string[], options?: TranslationOptions): string {
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
  public getEnglishString(namespace: string, key: string | string[], options?: TranslationOptions): string {
    const en = this._i18next.getFixedT("en", namespace);
    const str = en(key, options);
    if (typeof str !== "string")
      throw new Error("Translation key(s) not found");

    return str;
  }

  /** @internal */
  public loadNamespace(name: string, i18nCallback: any) {
    this._i18next.loadNamespaces(name, i18nCallback);
  }

  /** Get the promise for an already registered Namespace.
   * @param name - the name of the namespace
   * @public
   */
  public getNamespacePromise(name: string): Promise<void> | undefined {
    return this._namespaceRegistry.get(name);
  }

  /** @internal */
  public getLanguageList(): string[] {
    return this._i18next.languages;
  }

  /** override the language detected in the browser
   * @internal */
  public async changeLanguage(language: string) {
    this._i18next.changeLanguage(language);
  }

  /** Register a new Namespace and return it. If the namespace is already registered, it will be returned.
   * @param name - the name of the namespace, which is the base name of the JSON file that contains the localization properties.
   * @note - The registerNamespace method starts fetching the appropriate version of the JSON localization file from the server,
   * based on the current locale. To make sure that fetch is complete before performing translations from this namespace, await
   * fulfillment of the readPromise Promise property of the returned LocalizationNamespace.
   * @see [Localization in iModel.js]($docs/learning/frontend/Localization.md)
   * @public
   */
  public async registerNamespace(name: string, setDefault?: true): Promise<void> {
    const existing = this._namespaceRegistry.get(name);
    if (existing !== undefined)
      return existing;

    if (setDefault)
      this._i18next.setDefaultNamespace(name);

    const theReadPromise = new Promise<void>((resolve: any, _reject: any) => {
      this.loadNamespace(name, (err: any, _t: any) => {
        if (!err) {
          resolve();
          return;
        }
        // Here we got a non-null err object.
        // This method is called when the system has attempted to load the resources for the namespace for each
        // possible locale. For example 'fr-ca' might be the most specific local, in which case 'fr' ) and 'en are fallback locales.
        // using i18next-http-backend, err will be an array of strings that includes the namespace it tried to read and the locale. There
        // might be errs for some other namespaces as well as this one. We resolve the promise unless there's an error for each possible language.
        const errorList = err as string[];
        let locales = this.getLanguageList().map((thisLocale: any) => `/${thisLocale}/`);
        for (const thisError of errorList) {
          if (!thisError.includes(name))
            continue;
          locales = locales.filter((thisLocale) => !thisError.includes(thisLocale));
        }
        // if we removed every locale from the array, it wasn't loaded.
        if (locales.length === 0)
          Logger.logError("I18N", `The resource for namespace ${name} could not be loaded`);

        resolve();
      });
    });
    this._namespaceRegistry.set(name, theReadPromise);
    return theReadPromise;
  }

  /** @internal */
  public unregisterNamespace(name: string): void {
    this._namespaceRegistry.delete(name);
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
      message += "\n";
      for (let j = 0; j < i; ++j)
        message += "  ";
      message += args[i];
    }
    return message;
  }
}
