import * as i18next from "i18next";
import { i18n } from "i18next";
import * as i18nextXHRBackend from "i18next-xhr-backend";
import * as i18nextBrowserLanguageDetector from "i18next-browser-languagedetector";

export class I18N {
  private i18n: i18n;

  public constructor(nameSpaces: string[], defaultNameSpace: string, renderFunction: any) {
    this.i18n = i18next.createInstance();

    const initOptions: i18next.InitOptions = {
      interpolation: { escapeValue: true },
      fallbackLng: "en",
      ns: nameSpaces,
      defaultNS: defaultNameSpace,
      backend: {
        loadPath: "locales/{{lng}}/{{ns}}.json",
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

    this.i18n.use(i18nextXHRBackend)
      .init(initOptions, renderFunction);
  }

  public translate(key: string): string {
    return this.i18n.t(key);
  }
}

export class I18NManager {
  public static initialize(nameSpaces: string[], defaultNameSpace: string, renderFunction: any): I18N {
    // create a separate instance of i18next, so it doesn't interfere with other i18next instances.
    return new I18N(nameSpaces, defaultNameSpace, renderFunction);
  }
}
