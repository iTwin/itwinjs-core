// @public
class I18N {
  // @internal
  constructor(nameSpaces: string[], defaultNameSpace: string, options?: I18NOptions, renderFunction?: i18next.Callback);
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  languageList(): string[];
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  loadNamespace(name: string, i18nCallback: any): void;
  // @public
  registerNamespace(name: string): I18NNamespace;
  // @public
  translate(key: string | string[], options?: i18next.TranslationOptions): any;
  // @public
  translateKeys(line: string): string;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal (undocumented)
  unregisterNamespace(name: string): void;
  // WARNING: Because this definition is explicitly marked as @internal, an underscore prefix ("_") should be added to its name
  // @internal
  waitForAllRead(): Promise<void[]>;
}

// @public
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
