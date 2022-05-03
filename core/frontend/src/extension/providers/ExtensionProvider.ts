/**
 * Types, interfaces and functions shared by ExtensionProviders.
 */

/**
 * Required props for a local extension provider
 * @alpha
 */
export interface LocalExtensionProviderProps {
  /** a promise that returns the manifest (package.json) of a local extension */
  manifestPromise: Promise<any>;
  /** a function that runs the main entry point of the local extension */
  main: () => Promise<any>;
}

/**
 * Required props for a remote extension provider
 * @alpha
 */
export interface RemoteExtensionProviderProps {
  /** URL where the extension entry point can be loaded from */
  jsUrl: string;
  /** URL where the manifest (package.json) can be loaded from */
  manifestUrl: string;
}

/**
 * Required props for an Extension uploaded to Bentley's Extension Service
 * @alpha
 */
export interface ServiceExtensionProviderProps {
  /** Name of the uploaded extension */
  name: string;
  /** Version number (Semantic Versioning) */
  version: string;
  /** Context Id */
  contextId: string;
}

/**
 * Executes an extension's bundled javascript module.
 * First attempts an ES6 dynamic import,
 * second attempts a dynamic import via a script element as a fallback.
 * Throws an error if the module does not have a default or main function to execute
 * @internal
 */
export async function loadScript(jsUrl: string): Promise<any> {
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

interface ExtensionUploadStatus {
  updateTime: Date;
  status: string;
}

interface FileInfo {
  url: string;
  expires: Date;
  checksum: string;
}

/** Structure of extensions from the ExtensionService
 * @internal
 */
export interface ExtensionProps {
  contextId: string;
  extensionName: string;
  version: string;
  files: FileInfo[];
  uploadedBy: string;
  timestamp: Date;
  status: ExtensionUploadStatus;
  isPublic: boolean;
}

function statusFromJSON(jsonObject: any): ExtensionUploadStatus | undefined {
  if (jsonObject.statusUpdateTime === undefined || typeof jsonObject.statusUpdateTime !== "string" ||
    jsonObject.status === undefined || (jsonObject.status !== null && typeof jsonObject.status !== "string")) {

    return undefined;
  }

  return {
    updateTime: new Date(jsonObject.statusUpdateTime),
    status: jsonObject.status ?? "Valid",
  };
}

function fileInfoFromJSON(jsonObject: any): FileInfo | undefined {
  if (jsonObject.url === undefined || typeof jsonObject.url !== "string" ||
    jsonObject.expiresAt === undefined || typeof jsonObject.expiresAt !== "string" ||
    jsonObject.checksum === undefined || (typeof jsonObject.checksum !== "string" && jsonObject.checksum !== null)) {

    return undefined;
  }

  return {
    url: jsonObject.url,
    expires: new Date(jsonObject.expiresAt),
    checksum: jsonObject.checksum,
  };
}

/**
 * Validates JSON and returns ExtensionProps
 * @internal
 */
export function extensionPropsFromJSON(jsonObject: any): ExtensionProps | undefined {
  if (jsonObject.contextId === undefined || typeof jsonObject.contextId !== "string" ||
    jsonObject.extensionName === undefined || typeof jsonObject.extensionName !== "string" ||
    jsonObject.version === undefined || typeof jsonObject.version !== "string" ||
    jsonObject.files === undefined || !(jsonObject.files instanceof Array) ||
    jsonObject.uploadedBy === undefined || typeof jsonObject.uploadedBy !== "string" ||
    jsonObject.timestamp === undefined || typeof jsonObject.timestamp !== "string" ||
    jsonObject.isPublic === undefined || typeof jsonObject.isPublic !== "boolean" ||
    jsonObject.extensionStatus === undefined) {

    return undefined;
  }

  const status = statusFromJSON(jsonObject.extensionStatus);
  if (status === undefined)
    return undefined;

  const files: FileInfo[] = new Array(jsonObject.files.length);
  for (let i = 0; i < jsonObject.files.length; i++) {
    const parsed = fileInfoFromJSON(jsonObject.files[i]);
    if (parsed === undefined)
      return undefined;
    files[i] = parsed;
  }

  return {
    contextId: jsonObject.contextId,
    extensionName: jsonObject.extensionName,
    version: jsonObject.version,
    files,
    uploadedBy: jsonObject.uploadedBy,
    timestamp: new Date(jsonObject.timestamp),
    isPublic: jsonObject.isPublic,
    status,
  };
}
