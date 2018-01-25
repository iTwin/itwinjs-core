import * as i18next from "i18next";
import { i18n } from "i18next";
import * as i18nextXHRBackend from "i18next-xhr-backend";
import * as i18nextBrowserLanguageDetector from "i18next-browser-languagedetector";
import { IModelError } from "../common/IModelError";
import { iModelApp } from "./IModelApp";

export interface I18NOptions {
  urlTemplate?: string;
}

export class I18N {
  private i18n: i18n;

  public constructor(nameSpaces: string[], defaultNameSpace: string, options?: I18NOptions, renderFunction?: any) {
    this.i18n = i18next.createInstance();

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
      initOptions.lng = "en-pseudo";
      initOptions.debug = true;
    } else {
      this.i18n = this.i18n.use(i18nextBrowserLanguageDetector);
    }

    // call the changeLanguage method right away, before any calls to I18NNamespace.register. Otherwise, the call doesn't happen until the deferred load of the default namespace
    this.i18n.use(i18nextXHRBackend)
      .init(initOptions, renderFunction)
      .changeLanguage(undefined as any, undefined);
  }

  public translate(key: string): string {
    return this.i18n.t(key);
  }

  public loadNamespace(name: string, i18nCallback: any) {
    this.i18n.loadNamespaces(name, i18nCallback);
  }
  public languageList(): string[] {
    return this.i18n.languages;
  }
}

export class I18NNamespace {
  private constructor(public name: string, public readFinished: Promise<void>) { }

  // map of strings->I18NNamespace objects.
  private static map: Map<string, I18NNamespace> = new Map<string, I18NNamespace>();

  // register a new Namespace. Must be unique in the system.
  public static register(name: string): I18NNamespace {
    if (this.map.get(name)) {
      throw new IModelError(-1, "namespace must be unique");
    }
    const theReadPromise: Promise<void> = new Promise((resolve: any, _reject: any) => {
      iModelApp.i18N.loadNamespace(name, (err: any, _t: any) => {
        const locales: string[] = iModelApp.i18N.languageList().map((thisLocale) => {
          return ("/" + thisLocale + "/");
        });
        if (!err) {
          resolve();
          return;
        }
        // Here we got a non-null err object.
        // This method is called when the system has attempted to load the resources for the namespace for each
        // possible locale. For example 'fr-ca' might be the most specific local, in which case 'fr' ) and 'en are fallback locales.
        // using i18next-xhr-backend, err will be an array of strings that includes the namespace it tried to read and the locale. There
        // might be errs for some other namespaces as well as this one. We resolve the promise unless there's an error for each possible language.
        const errorList: string[] = err as string[];
        for (const thisErr of errorList) {
          if (!thisErr.includes(name))
            continue;
          for (let iLocale: number = 0; iLocale < locales.length; ++iLocale) {
            if (thisErr.includes(locales[iLocale] + "/")) {
              locales.splice(iLocale, 1);
            }
          }
        }
        // if we removed every locale from the array, it wasn't loaded.
        if (locales.length > 0)
          resolve();
        else
          throw new IModelError(-1, "The resource for namespace" + name + "could not be loaded");
      });
    });
    const thisNamespace: I18NNamespace = new I18NNamespace(name, theReadPromise);
    this.map.set(name, thisNamespace);
    return thisNamespace;
  }
}
