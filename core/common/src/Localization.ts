/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Localization
 */

/** Options for Localization
 * @public
 */
interface LocalizationOptions {
  /** for interpolation values */
  [key: string]: any;
  /**
   * defaultValue to return if a translation was not found
   */
  defaultValue?: any;
  /**
   * count value used for plurals
   */
  count?: number;
  /**
   * used for contexts (eg. male\female)
   */
  context?: any;
  /**
   * override languages to use
   */
  lngs?: string[];
  /**
   * override language to lookup key if not found see fallbacks for details
   */
  fallbackLng?: string;
}

/** The interface defining the localization requirements of [IModelApp]($frontend).
 * @public
 */
export interface Localization {
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
   */
  getLocalizedString(key: string | string[], options?: LocalizationOptions): string;
  /** Similar to 'translate()' but the namespace is a separate param and the key does not include the namespace.
   * @param namespace - the namespace that identifies the particular localization file that contains the property.
   * @param key - the key that matches a property in the JSON localization file.
   * @returns The string corresponding to the first key that resolves.
   * @throws Error if no keys resolve to a string.
   */
  getLocalizedStringWithNamespace(namespace: string, key: string | string[], options?: LocalizationOptions): string;
  /** get the English string for a key. */
  getEnglishString(namespace: string, key: string | string[], options?: LocalizationOptions): string;
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
   * getLocalizedKeys("string with %{MyKeys.Key1} followed by %{MyKeys.Key2}!"") // returns "string with First Value followed by Second Value!"
   * ```
   */
  getLocalizedKeys(inputString: string): string;

  /** Register a new Namespace and return a Promise that is fulfilled when the content is loaded.
   * If the namespace is already registered, its Promise will be returned.
   * @param name - the name of the namespace.
   * @note - The registerNamespace method starts fetching the appropriate version of the JSON localization file from the server,
   * based on the current locale. To make sure that fetch is complete before performing translations from this namespace, await
   * fulfillment of returned Promise.
   * @see [Localization in iTwin.js]($docs/learning/frontend/Localization.md)
   */
  registerNamespace(namespace: string, setDefault?: true): Promise<void>;
  /** @internal */
  unregisterNamespace(namespace: string): void;
  /** @internal */
  getNamespacePromise(name: string): Promise<void> | undefined;
  /** Get the list of available languages for translations */
  getLanguageList(): string[];
  /** Change the language for translations. This overrides the language from the browser, for tests.
   * @internal
  */
  changeLanguage(language: string): Promise<void>;
}

/** An empty [[Localization]] used if one is not provided to [IModelApp]($frontend). Does not perform localizations (merely returns the key.)
 * @public
 */
export class EmptyLocalization implements Localization {
  public getLocalizedString(key: string | string[]): string { return typeof (key) == "string" ? key : key[0]; }
  public getLocalizedStringWithNamespace(_namespace: string, key: string | string[]): string { return this.getLocalizedString(key); }
  public getEnglishString(_namespace: string, key: string | string[]): string { return this.getLocalizedString(key); }
  public getLocalizedKeys(inputString: string): string { return inputString; }
  public async registerNamespace(): Promise<void> { }
  public unregisterNamespace(): void { }
  public getNamespacePromise(): Promise<void> | undefined { return undefined; }
  public getLanguageList(): string[] { return []; }
  public async changeLanguage() { }
}
