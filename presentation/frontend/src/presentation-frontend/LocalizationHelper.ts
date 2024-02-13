/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { LocalizationHelper } from "@itwin/presentation-common";
import { Presentation } from "./Presentation";

const NAMESPACES = ["Presentation"];

/** @internal */
export class FrontendLocalizationHelper extends LocalizationHelper {
  private _lang: string | undefined;
  constructor(lang?: string) {
    super({ getLocalizedString: (key) => Presentation.localization.getLocalizedString(key, { defaultValue: key, lng: this._lang }) });
    this._lang = lang;
  }

  public get locale() {
    return this._lang;
  }
  public set locale(locale: string | undefined) {
    this._lang = locale;
  }

  public static async registerNamespaces() {
    const localizationPromises = NAMESPACES.map(async (namespace) => Presentation.localization.registerNamespace(namespace));
    await Promise.all(localizationPromises);
  }

  public static unregisterNamespaces() {
    NAMESPACES.map((namespace) => Presentation.localization.unregisterNamespace(namespace));
  }
}
