// @public
class Presentation {
  // WARNING: The type "PresentationManager" needs to be exported by the package (e.g. added to index.ts)
  static getManager(clientId?: string): PresentationManager;
  // WARNING: The type "Props" needs to be exported by the package (e.g. added to index.ts)
  static initialize(props?: Props): void;
  // WARNING: The type "Props" needs to be exported by the package (e.g. added to index.ts)
  // (undocumented)
  static readonly initProps: Props | undefined;
  static terminate(): void;
}

// (No @packagedocumentation comment for this package)
