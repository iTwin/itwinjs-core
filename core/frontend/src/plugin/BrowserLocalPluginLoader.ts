// This file is a partial implementation of a PluginLoader that downloads a tar file locally from the server
// (into a Buffer) and fulfills all the resource requests by creating blob URLs from the components of the at file.
// It compiled at one point, but it is no longer used so I took it out of the compilation for the time being.
// To get it compiling again, see below:

import { IModelApp } from "../IModelApp";
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import untar = require("js-untar");
import { PendingPlugin, PluginAdmin, PluginLoader, PluginLoadResults } from "./Plugin";
import { request, Response, RequestOptions } from "@bentley/imodeljs-clients";

/* -------
This is what needs to be done in Plugin.ts to re-enable BrowserLocalPluginLoader:

1. Put in this import:
import { BrowserLocalPluginLoader } from "./BrowserLocalPluginLoader";

2. Drop BrowserLocalPlugLonader from tsconfig.json, export PluginLoader and PendingPlugin.

3. Put this back into the globally executed code.:
// controls loading to local member or untarring plugin tarfile on server.
const loadWithServer: boolean = true;

4. Put this logic into PluginAdmin.loadPlugin where the PluginLoader is calculated.
    const pluginLoader: PluginLoader = (-1 !== pluginSpec.indexOf("/")) ? new ExternalServerPluginLoader() : (loadWithServer ? new ServerAssistedPluginLoader() : new BrowserLocalPluginLoader());

5. export PluginLoader and PendingPlugin.
---------- */

// these are the properties found in "files" extracted by untar.
interface ExtractedFile {
  buffer: ArrayBuffer;
  name: string;
  size: number;
  readAsString(): string;
  readAsJSON(): any;
  getBlobUrl(): string;
}

// this class reads the plugin as a tarfile from a URL and untars it locally.
export class BrowserLocalPluginLoader implements PluginLoader {

  private _pluginRootName: string | undefined;
  private _extractedFiles: ExtractedFile[] | undefined;

  public async initialize(pluginRootName: string): Promise<PluginLoadResults> {
    this._pluginRootName = pluginRootName;
    const tarFileName: string = PluginAdmin.getTarFileName(pluginRootName);

    try {
      const tarFileUrl = "/plugins/".concat(tarFileName);
      const arrayBuffer: ArrayBuffer = await this.readPluginTarFileFromServer(tarFileUrl);
      this._extractedFiles = await untar(arrayBuffer);
      return undefined;
    } catch (error) {
      return Promise.resolve(error.toString());
    }
  }

  // gets I18N for plugin to use. We could probably figure out a custom i18next here if we end up using this loader.
  public getI18n() {
    return IModelApp.i18n;
  }

  // We could figure out something better - extracting the blob and making a blob url.
  public resolveResourceUrl(relativeUrl: string) {
    return relativeUrl;
  }

  public getPluginRoot(pluginSpec: string): string {
    return pluginSpec;
  }

  public async getManifest(): Promise<any> {
    const manifestFile: ExtractedFile | undefined = this.findFileFromExtracted(this._extractedFiles!, "manifest.json");
    if (!manifestFile) {
      return Promise.reject("Unable to find required manifest.json in tar file");
    }

    return manifestFile.readAsJSON();
  }

  // reads the tar file from the server.
  private async readPluginTarFileFromServer(tarFileName: string): Promise<ArrayBuffer> {
    const requestContext = new ClientRequestContext("");
    const requestOptions: RequestOptions = {
      method: "GET",
      responseType: "arraybuffer",
    };
    try {
      const response: Response = await request(requestContext, tarFileName, requestOptions);
      return Promise.resolve(response.body);
    } catch (error) {
      // couldn't get the plugin
      return Promise.resolve(error);
    }
  }

  // reads a file as a text file from the server. We use this to see whether the development version of the Javascript is available on the server
  // in which case we run that rather than the version in the tar file, for smoother debugging (the development tools can find the source map).
  private async readTextFileFromServer(url: string): Promise<string> {
    try {
      const requestContext = new ClientRequestContext("");
      const requestOptions: RequestOptions = {
        method: "GET",
        responseType: "text",
      };
      const response: Response = await request(requestContext, url, requestOptions);
      return Promise.resolve(response.text ? response.text : "");
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /* ---------- NOT_USED --------------------
  // this was an attempt to get the development tools to find the source map from the tar file. It didn't work, so is commented off.
  private static fixSourceMapUrl(javaScriptFile: ExtractedFile, extractedFiles: ExtractedFile[], jsFileName: string) {
    const scriptContents: string = javaScriptFile.readAsString();
    const sourceMapSpecIndex = scriptContents.lastIndexOf("//# sourceMappingURL=");
    if (sourceMapSpecIndex !== -1) {
      const sourceMapFile = PluginAdmin.findFileFromExtracted(extractedFiles, jsFileName.concat(".map"));
      if (sourceMapFile) {
        const sourceMapUrl = sourceMapFile.getBlobUrl();
        const newScriptContents = scriptContents.slice(0, sourceMapSpecIndex).concat("//# sourceMappingURL=", sourceMapUrl);
        javaScriptFile.buffer = new ArrayBuffer(newScriptContents.length);
        const bufferView = new Uint8Array(javaScriptFile.buffer);
        for (let i = 0, strLen = newScriptContents.length; i < strLen; i++) {
          bufferView[i] = newScriptContents.charCodeAt(i);
        }
      }
    }
  }
  -------------- NOT_USED ----------------- */

  // finds a file by name from the array of extracted files.
  private findFileFromExtracted(extractedFiles: ExtractedFile[], fileName: string): ExtractedFile | undefined {
    return extractedFiles.find(function (this, thisFile: ExtractedFile, _index: number, _array: ExtractedFile[]) { return thisFile.name === (this as unknown); }, fileName);
  }

  public async loadPlugin(buildType: string, manifest: any, args: string[]): Promise<PluginLoadResults> {
    // If we are in a dev build, we first try to load the javascript file from the local disk rather than using the one that is packed into the tar file. That way it can be debugged.
    let jsFileUrl: string | undefined;
    if (buildType === "dev") {
      if (jsFileUrl = manifest.devPlugin) {
        try {
          await this.readTextFileFromServer(jsFileUrl);
        } catch (error) {
          jsFileUrl = undefined;
        }
      }
    }

    if (!jsFileUrl) {
      const jsFileName = buildType.concat("/", manifest.bundleName, ".js");
      const javaScriptFile: ExtractedFile | undefined = this.findFileFromExtracted(this._extractedFiles!, jsFileName);

      if (!javaScriptFile) {
        return Promise.resolve(`Unable to find JavaScript file ${jsFileName} in tar file`);
      }

      /* -------------- NOT_USED -------------------
      // if this is a dev build, attempt to change the URL of the source map.
      // NOTE: This did not work, Chrome devtools did not find the source map.
      if (buildType === "dev") {
        PluginAdmin.fixSourceMapUrl(javaScriptFile, extractedFiles, jsFileName);
      }
      ------------------- NOT_USED ----------------- */

      // get the url for the javascript "file" and load it.
      jsFileUrl = javaScriptFile.getBlobUrl();
    }

    // set it up to load.
    const newPendingPlugin: PendingPlugin = new PendingPlugin(this._pluginRootName!, jsFileUrl, this, args);

    // Javascript-ish saving of the arguments in the promise, so we can call onLoad with them.
    PluginAdmin.addPendingPlugin(this._pluginRootName!, newPendingPlugin);
    return newPendingPlugin.promise;
  }
}
