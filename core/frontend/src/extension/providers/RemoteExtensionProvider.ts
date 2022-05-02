import type {
  ExtensionManifest,
  ExtensionProviderInterface,
  RemoteExtensionProviderProps,
} from "../Extension";

/**
 * Implements a "remote" extension.
 * Remote extensions are hosted on a server somewhere and are first loaded when added to the ExtensionAdmin.
 * The execute() and getManifest() methods are used by the ExtensionAdmin.
 * @alpha
 */
export class RemoteExtensionProvider implements ExtensionProviderInterface {
  /** The name of the server where the extension is hosted. */
  public readonly hostname: string;

  constructor(private readonly _props: RemoteExtensionProviderProps) {
    this.hostname = new URL(this._props.jsUrl).hostname.replace("www", "");
  }

  /**
   * Attempts to execute an extension.
   * Throws an error if the provided jsUrl does not exist.
   */
  public async execute(): Promise<string> {
    const doesUrlExist = await this._exists(this._props.jsUrl);
    if (!doesUrlExist) {
      throw new Error(`Extension at ${this._props.jsUrl} could not be found.`);
    }
    return this._loadScript(this._props.jsUrl);
  }

  /**
   * Attempts to fetch an extension's manifest (package.json) file.
   * Throws an error if the provided manifestUrl does not exist.
   */
  public async getManifest(): Promise<ExtensionManifest> {
    const doesUrlExist = await this._exists(this._props.manifestUrl);
    if (!doesUrlExist) {
      throw new Error(`Manifest at ${this._props.manifestUrl} could not be found.`);
    }
    return (await fetch(this._props.manifestUrl)).json();
  }

  /** check if url actually exists */
  private async _exists(url: string): Promise<boolean> {
    let exists = false;
    // check if the entry point exists
    try {
      const response = await fetch(url, { method: "HEAD" });
      if (response.status === 200)
        exists = true;
    } catch (error) {
      exists = false;
    }
    return exists;
  }

  /**
   * Executes an extension's bundled javascript module.
   * First attempts an ES6 dynamic import,
   * second attempts a dynamic import via a script element as a fallback.
   * Throws an error if the module does not have a default or main function to execute.
  */
  private async _loadScript(jsUrl: string): Promise<any> {
    function loadModule(m: any) {
      if (typeof m === "function")
        return m();
      if (m.main && typeof m.main === "function")
        return m.main();
      if (m.default && typeof m.default === "function")
        return m.default();
      throw new Error(`No default function was found to execute in extension at ${jsUrl}`);
    }

    try {
      const module = await import(/* webpackIgnore: true */jsUrl);
      return loadModule(module);
    } catch (e) {
      return new Promise((resolve, reject) => {
        const head = document.getElementsByTagName("head")[0];
        if (!head)
          reject(new Error("no head element found"));

        const scriptElement = document.createElement("script");
        const tempGlobal: string = `__tempModuleLoadingVariable${Math.random().toString(32).substring(2)}`;

        function cleanup() {
          delete (window as any)[tempGlobal];
          scriptElement.remove();
        }

        // can this (https://github.com/tc39/proposal-dynamic-import) be done without a global?
        (window as any)[tempGlobal] = async function (module: any) {
          await loadModule(module);
          cleanup();
          resolve(module);
        };
        scriptElement.type = "module";
        scriptElement.textContent = `import * as m from "${jsUrl}";window.${tempGlobal}(m);`;

        scriptElement.onerror = () => {
          reject(new Error(`Failed to load module script with URL ${jsUrl}`));
          cleanup();
        };

        head.insertBefore(scriptElement, head.lastChild);
      });
    }
  }
}
