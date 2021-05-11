/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as I18NodeFSBackend from "i18next-node-fs-backend";
import { I18N } from "@bentley/imodeljs-i18n";
import { DiagnosticCategory, DiagnosticType } from "../../Validation/Diagnostic";
import { DiagnosticCodes } from "../../Validation/ECRules";

/* eslint-disable @typescript-eslint/naming-convention */

export const testMessages = {
  TestErrorA: { code: DiagnosticCodes.BaseClassIsSealed, category: DiagnosticCategory.Error, diagnosticType: DiagnosticType.SchemaItem, key: "TestErrorA", message: "Test message with parameter '{0}'" },
  TestErrorB: { code: DiagnosticCodes.BaseClassIsSealed, category: DiagnosticCategory.Error, diagnosticType: DiagnosticType.SchemaItem, key: "TestErrorB", message: "Second test message with parameter '{0}'" },
  TestWarning: { code: DiagnosticCodes.BaseClassIsSealed, category: DiagnosticCategory.Warning, diagnosticType: DiagnosticType.SchemaItem, key: "TestWarning", message: "Test warning message." },
  TestMessage: { code: DiagnosticCodes.BaseClassIsSealed, category: DiagnosticCategory.Message, diagnosticType: DiagnosticType.SchemaItem, key: "TestWarning", message: "Test message." },
  TestSuggestion: { code: DiagnosticCodes.BaseClassIsSealed, category: DiagnosticCategory.Suggestion, diagnosticType: DiagnosticType.SchemaItem, key: "TestSuggestion", message: "Test suggestion." },
};

type LoadCallback = (error: any, result: any) => void;

interface BackendOptions { test: undefined }

export class I18NTestHelper {
  private static _i18n?: I18N;
  private static _i18nFrench?: I18N;
  private static _i18nNodeFSBackend?: I18N;

  public static get i18n(): I18N {
    if (!I18NTestHelper._i18n) {
      const i18nOptions = { urlTemplate: "public/locales/{{lng}}/{{ns}}.json", backend: testBackend };
      I18NTestHelper._i18n = new I18N([], i18nOptions);
    }
    return I18NTestHelper._i18n;
  }

  public static get i18NodeFSBackend(): I18N {
    if (!I18NTestHelper._i18nNodeFSBackend) {
      const i18nOptions = { urlTemplate: "public/locales/{{lng}}/{{ns}}.json", backend: I18NodeFSBackend };
      I18NTestHelper._i18nNodeFSBackend = new I18N([], i18nOptions);
    }
    return I18NTestHelper._i18nNodeFSBackend;
  }

  public static get i18nFrench(): I18N {
    if (!I18NTestHelper._i18nFrench) {
      const i18nOptions = { urlTemplate: "public/locales/{{lng}}/{{ns}}.json", backend: testBackend, languageDetector: testLangDetector };
      I18NTestHelper._i18nFrench = new I18N([], i18nOptions);
    }
    return I18NTestHelper._i18nFrench;
  }

  public static cleanup() {
    this._i18n = undefined;
    this._i18nFrench = undefined;
  }
}

export const testBackend = {
  type: "backend",
  init(services?: any, options?: BackendOptions) {
    /* use services and options */
    services;
    options;
  },

  read(language: string, namespace: string, callback: LoadCallback) {
    namespace;
    callback;

    /* return resources */
    if (language === "en") {
      const result = { Diagnostics: { TestErrorA: testMessages.TestErrorA.message } }; // eslint-disable-line @typescript-eslint/naming-convention
      callback(undefined, result);
    }

    if (language === "fr") {
      const result = { Diagnostics: { TestErrorA: "Message de test avec paramètre '{0}'" } }; // eslint-disable-line @typescript-eslint/naming-convention
      callback(undefined, result);
    }
  },

  create(languages: string | string[], namespace: string, key: string, fallbackValue: string) {
    const test = "test";
    test;
    namespace;
    languages;
    key;
    fallbackValue;
  },
};

export const testLangDetector = {
  type: "languageDetector",
  init: Function.prototype,
  detect: () => {
    return "fr";
  },
  cacheUserLanguage: Function.prototype,
};
