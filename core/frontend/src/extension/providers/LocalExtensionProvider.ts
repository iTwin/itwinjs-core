import type {
  ExtensionManifest,
  ExtensionProviderInterface,
  LocalExtensionProviderProps,
} from "../Extension";

/**
 * Implements a "local" extension via LocalExtensionProps.
 * An extension is not loaded until it is added to the ExtensionAdmin.
 * The execute() and getManifest() methods are used by the ExtensionAdmin.
 * @alpha
 */
export class LocalExtensionProvider implements ExtensionProviderInterface {
  constructor(private readonly _props: LocalExtensionProviderProps) { }

  /** returns the manifest (package.json) of a local extension */
  public async getManifest(): Promise<ExtensionManifest> {
    return this._props.manifestPromise;
  }

  /** executes the javascript main file / bundle (index.js) of a local extension */
  public async execute(): Promise<any> {
    return this._props.main();
  }
}
