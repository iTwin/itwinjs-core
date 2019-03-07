// @public
class I18N {
  constructor(nameSpaces: string[], defaultNameSpace: string, options?: I18NOptions, renderFunction?: i18next.Callback);
  // (undocumented)
  languageList(): string[];
  // (undocumented)
  loadNamespace(name: string, i18nCallback: any): void;
  // (undocumented)
  registerNamespace(name: string): I18NNamespace;
  translate(key: string | string[], options?: i18next.TranslationOptions): any;
  translateKeys(line: string): string;
  // (undocumented)
  unregisterNamespace(name: string): void;
  // (undocumented)
  waitForAllRead(): Promise<void[]>;
}

// @public (undocumented)
class I18NNamespace {
  constructor(name: string, readFinished: Promise<void>);
  // (undocumented)
  name: string;
  // (undocumented)
  readFinished: Promise<void>;
}

// @public (undocumented)
interface I18NOptions {
  // (undocumented)
  urlTemplate?: string;
}

// (No @packagedocumentation comment for this package)
