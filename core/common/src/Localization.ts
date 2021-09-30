/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Localization
 */

/** @public */
// This should be more clearly defined or removed as we remove I18N and its dependencies (Formerly i18next::TranslationOptions).
type LocalizationOptions = any;

/** The interface defining the localization requirements of iModelJs.
 * @public
 */
export interface Localization {
  /** Returns the localized string. If an array is provided, localizes and returns the first recognized key in the array. */
  getLocalizedString(key: string | string[], options?: LocalizationOptions): string;
  /** Returns the localized string under the provided namespace. If an array is provided, localizes and returns the first recognized key in the array. */
  getLocalizedStringWithNamespace(namespace: string, key: string | string[], options?: LocalizationOptions): string;
  getEnglishString(namespace: string, key: string | string[], options?: LocalizationOptions): string;
  getLocalizedKeys(inputString: string): string;
  registerNamespace(namespace: string): Promise<void>;
  unregisterNamespace(namespace: string): void;
  getNamespace(name: string): Promise<void> | undefined;
  languageList(): string[];
}

/** The default [[Localization]] used in the event that an implementation is not provided to [[IModelApp]]. Does not perform localizations.
 * @public
 */
export class EmptyLocalization implements Localization {
  public getLocalizedString(key: string | string[]): string { return typeof (key) == "string" ? key : key[0]; }
  public getLocalizedStringWithNamespace(_namespace: string, key: string | string[]): string { return typeof (key) == "string" ? key : key[0]; }
  public getEnglishString(_namespace: string, key: string | string[]): string { return typeof (key) == "string" ? key : key[0]; }
  public getLocalizedKeys(inputString: string): string { return inputString; }
  public async registerNamespace(): Promise<void> { return; }
  public unregisterNamespace(): void { }
  public getNamespace(): Promise<void> | undefined { return; }
  public languageList(): string[] { return []; }
}
