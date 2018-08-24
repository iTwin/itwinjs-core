/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module AppAdministration */

import * as i18next from "i18next";
import { i18n } from "i18next";
import * as i18nextXHRBackend from "i18next-xhr-backend";
import * as i18nextBrowserLanguageDetector from "i18next-browser-languagedetector";
import { BentleyError } from "@bentley/bentleyjs-core";
import { Logger } from "@bentley/bentleyjs-core";

export interface I18NOptions {
  urlTemplate?: string;
}

export class I18N {
  private _i18n: i18n;
  private _namespaceRegistry: Map<string, I18NNamespace> = new Map<string, I18NNamespace>();

  public constructor(nameSpaces: string[], defaultNameSpace: string, options?: I18NOptions, renderFunction?: any) {
    this._i18n = i18next.createInstance();

    const initOptions: i18next.InitOptions = {
      interpolation: { escapeValue: true },
      fallbackLng: "en",
      ns: nameSpaces,
      defaultNS: defaultNameSpace,
      backend: {
        loadPath: options && options.urlTemplate ? options.urlTemplate : "locales/{{lng}}/{{ns}}.json",
        crossDomain: true,
      },
    };

    // if in a development environment, set to pseudo-localize, otherwise detect from browser.
    const isDevelopment: boolean = process.env.NODE_ENV === "development";
    if (isDevelopment) {
      initOptions.debug = true;
    } else {
      this._i18n = this._i18n.use(i18nextBrowserLanguageDetector);
    }

    // call the changeLanguage method right away, before any calls to I18NNamespace.register. Otherwise, the call doesn't happen until the deferred load of the default namespace
    this._i18n.use(i18nextXHRBackend)
      .use(BentleyLogger)
      .init(initOptions, renderFunction)
      .changeLanguage(isDevelopment ? "en-pseudo" : undefined as any, undefined);
  }

  /**
   * Replace all instances of `%{key}` within a string with the translations of those keys.
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
   */
  public translateKeys(line: string): string { return line.replace(/\%\{(.+?)\}/g, (_match, tag) => this.translate(tag)); }

  /** Return the translated value of a key. */
  public translate(key: string | string[], options?: i18next.TranslationOptions): any { return this._i18n.t(key, options); }

  public loadNamespace(name: string, i18nCallback: any) { this._i18n.loadNamespaces(name, i18nCallback); }
  public languageList(): string[] { return this._i18n.languages; }

  // register a new Namespace. Must be unique in the system.
  public registerNamespace(name: string): I18NNamespace {
    if (this._namespaceRegistry.get(name))
      throw new BentleyError(-1, "namespace '" + name + "' is not unique");

    const theReadPromise = new Promise<void>((resolve: any, _reject: any) => {
      this.loadNamespace(name, (err: any, _t: any) => {
        if (!err) {
          resolve();
          return;
        }
        // Here we got a non-null err object.
        // This method is called when the system has attempted to load the resources for the namespace for each
        // possible locale. For example 'fr-ca' might be the most specific local, in which case 'fr' ) and 'en are fallback locales.
        // using i18next-xhr-backend, err will be an array of strings that includes the namespace it tried to read and the locale. There
        // might be errs for some other namespaces as well as this one. We resolve the promise unless there's an error for each possible language.
        const errorList = err as string[];
        let locales: string[] = this.languageList().map((thisLocale: any) => "/" + thisLocale + "/");
        for (const thisError of errorList) {
          if (!thisError.includes(name))
            continue;
          locales = locales.filter((thisLocale) => !thisError.includes(thisLocale));
        }
        // if we removed every locale from the array, it wasn't loaded.
        if (locales.length === 0)
          Logger.logError("I81N", "The resource for namespace " + name + " could not be loaded");

        resolve();
      });
    });
    const thisNamespace = new I18NNamespace(name, theReadPromise);
    this._namespaceRegistry.set(name, thisNamespace);
    return thisNamespace;
  }

  public waitForAllRead(): Promise<void[]> {
    const namespacePromises = new Array<Promise<void>>();
    for (const thisNamespace of this._namespaceRegistry.values()) {
      namespacePromises.push(thisNamespace.readFinished);
    }
    return Promise.all(namespacePromises);
  }
}

export class I18NNamespace {
  public constructor(public name: string, public readFinished: Promise<void>) { }
}

class BentleyLogger {
  public static readonly type = "logger";
  public log(args: string[]) { Logger.logInfo("i18n", this.createLogMessage(args)); }
  public warn(args: string[]) { Logger.logWarning("i18n", this.createLogMessage(args)); }
  public error(args: string[]) { Logger.logError("i18n", this.createLogMessage(args)); }
  private createLogMessage(args: string[]) {
    let message = args[0];
    for (let i = 1; i < args.length; ++i) {
      message += "\n";
      for (let j = 0; j < i; ++j)
        message += "    ";
      message += args[i];
    }
    return message;
  }
}
