/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

// The purpose of this file (which is standalone, and not webpacked into the imodeljs-frontend module)
// is to load all of the iModelJs modules. The application's main entry point should be webpacked
// using webpackModule.config.js, which separates it into a main.js and runtime.js.
// The initial webpage, index.html, should have these two script tags in its <header> tag:
//
//   <script type="text/javascript" src="runtime.js"></script>
//   <script type="text/javascript" src="IModelJsLoader.js"></script>
//
// Other script tags can be put after IModelJsLoader.
//
// runtime.js must be first, then IModelJsLoader.js. IModelJsLoader loads all the
// dependent modules first, then loads the application's main.js.
//
// IModelJsLoader is also compiled and then webpacked using webpackModule.config.js.
//
// This attempts to parallelize loading to a minor extent, but remember that each module can be loaded
// only after all of the modules it depends on are loaded. The iModelJs packages are largely
// built as a stack of dependencies, with each module (either directly or indirectly) dependent on all
// of the "lower-level" modules in the system.
//
// The webpacked IModelJsLoader.js is copied to the output directory of an application by the
// copyDependentModules script, which should be executed from a task in the application's package.json.

// ----------------------------------------------------------------------------------------------------
// This class borrowed the basic idea from scriptjs, but it drops all of the weird Javascript syntax and
// unnecessary options, and returns a Promise rather than use a callback. Thus it is much simpler to use.
// ----------------------------------------------------------------------------------------------------
class ScriptLoader {

  // loads a single package
  public static async loadPackage(packageName: string | undefined): Promise<void> {
    // if there is no package, just return resolve promise.
    if (!packageName) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const head = document.getElementsByTagName("head")[0];
      if (!head)
        reject(new Error("no head element found"));

      // create the script element. handle onload and onerror.
      const scriptElement = document.createElement("script");
      scriptElement.onload = () => {
        scriptElement.onload = null;
        resolve();
      };
      scriptElement.onerror = (ev) => {
        scriptElement.onload = null;
        reject(new Error("can't load " + packageName + " : " + ev));
      };
      scriptElement.async = true;
      scriptElement.src = packageName;
      head.insertBefore(scriptElement, head.lastChild);
    });
  }

  // loads a single css file
  public static async loadCss(cssName: string | undefined): Promise<void> {
    // if there is no package, just return resolve promise.
    if (!cssName) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const head = document.getElementsByTagName("head")[0];
      if (!head)
        reject(new Error("no head element found"));

      // create the script element. handle onload and onerror.
      const cssElement: HTMLLinkElement = document.createElement("link");
      cssElement.onload = () => {
        cssElement.onload = null;
        resolve();
      };
      cssElement.onerror = (ev) => {
        cssElement.onload = null;
        reject(new Error("can't load " + cssName + " : " + ev));
      };
      cssElement.type = "text/css";
      cssElement.rel = "stylesheet";
      cssElement.href = cssName;
      head.insertBefore(cssElement, head.lastChild);
    });
  }

  // loads an array of packages in parallel. Promise is resolved when all are loaded.
  // The packages can be loaded in any order, so they must be independent of each other.
  public static async loadPackagesParallel(packages: string[], options: IModelJsLoadOptions): Promise<void[]> {
    const promises: Array<Promise<void>> = new Array<Promise<void>>();
    for (const thisPackage of packages) {
      promises.push(this.loadPackage(options.prefixVersion(thisPackage)));
    }
    return Promise.all(promises);
  }

  // look for any css files that need to be loaded and load them all in parallel.
  public static async loadAllCssFiles(options: IModelJsLoadOptions): Promise<void[]> {
    const promises: Array<Promise<void>> = new Array<Promise<void>>();
    for (const key in options.iModelJsVersions) {
      if (options.iModelJsVersions.hasOwnProperty(key)) {
        if (key.endsWith(".css")) {
          const cssFileName = "v".concat(options.iModelJsVersions[key], "/", key);
          promises.push(this.loadCss(cssFileName));
        }
      }
    }

    if (0 === promises.length) {
      return Promise.resolve([]);
    }
    return Promise.all(promises);
  }
}

// Load Options. Loading the UiComponents and UiFramework are optional.
class IModelJsLoadOptions {
  private _iModelJsCDN: string;

  public iModelJsVersions: any;
  public loadUiComponents: boolean;
  public loadUiFramework: boolean;
  public loadECPresentation: boolean;
  public loadMarkup: boolean;

  // IModelJsVersionString is a JSON string. The object properties are the module names, and the values are the versions.
  constructor(iModelJsVersionString: string | null, iModelJsModuleCDN: string | null) {
    this.loadUiComponents = true;
    this.loadUiFramework = true;
    this.loadECPresentation = true;
    this.loadMarkup = true;

    if (iModelJsVersionString) {
      this.iModelJsVersions = JSON.parse(iModelJsVersionString);
      this.loadUiComponents = (undefined !== this.iModelJsVersions["ui-core"]) || (undefined !== this.iModelJsVersions["ui-components"]);
      this.loadUiFramework = (undefined !== this.iModelJsVersions["ui-ninezone"]) || (undefined !== this.iModelJsVersions["ui-framework"]);
      this.loadECPresentation = (undefined !== this.iModelJsVersions["presentation-common"]) || (undefined !== this.iModelJsVersions["presentation-frontend"]) || (undefined !== this.iModelJsVersions["presentation-components"]);
      this.loadMarkup = (undefined !== this.iModelJsVersions["imodeljs-markup"]);

      // we need the uiComponents for either ECPresentation or uiFramework.
      if (this.loadECPresentation || this.loadUiFramework) {
        this.loadUiComponents = true;
      }
    } else {
      this.iModelJsVersions = {};
    }
    this._iModelJsCDN = iModelJsModuleCDN ? iModelJsModuleCDN : "";
  }

  public prefixVersion(packageName: string): string | undefined {
    // find the version from the package name.
    let versionNumberString: string;
    if (undefined === (versionNumberString = this.iModelJsVersions[packageName])) {
      // tslint:disable-next-line:no-console
      console.log("No version specified for ", packageName);
      return undefined;
    }
    return this._iModelJsCDN.concat("v", versionNumberString, "/", packageName, ".js");
  }

}

/** Loads the iModelJs modules and the external modules that they depend on.
 * @internal
 */
export async function loadIModelJs(options: IModelJsLoadOptions): Promise<void> {
  // if we are going to load the ui modules, get the third party stuff started now. They don't depend on any of our modules so can be loaded at any time.
  const cssFilesPromise = ScriptLoader.loadAllCssFiles(options);

  let thirdPartyRootPromise;
  if (options.loadUiComponents)
    thirdPartyRootPromise = ScriptLoader.loadPackagesParallel(["lodash", "react", "redux"], options);

  // load the lowest level stuff. geometry-core doesn't depend on bentleyjs-core, so they can be loaded together.
  await ScriptLoader.loadPackagesParallel(["bentleyjs-core", "geometry-core"], options);
  await ScriptLoader.loadPackage(options.prefixVersion("imodeljs-i18n"));
  await ScriptLoader.loadPackage(options.prefixVersion("imodeljs-clients"));
  await ScriptLoader.loadPackage(options.prefixVersion("imodeljs-common"));
  await ScriptLoader.loadPackage(options.prefixVersion("imodeljs-quantity"));
  await ScriptLoader.loadPackage(options.prefixVersion("imodeljs-frontend"));
  if (options.loadMarkup)
    await ScriptLoader.loadPackage(options.prefixVersion("imodeljs-markup"));
  if (options.loadUiComponents) {
    await thirdPartyRootPromise;
    // load the rest of the third party modules that depend on react and redux.
    await ScriptLoader.loadPackagesParallel(["react-dom", "inspire-tree", "react-dnd", "react-dnd-html5-backend", "react-redux"], options);
    await ScriptLoader.loadPackage(options.prefixVersion("ui-core"));
    await ScriptLoader.loadPackage(options.prefixVersion("ui-components"));
    if (options.loadECPresentation) {
      await ScriptLoader.loadPackage(options.prefixVersion("presentation-common"));
      await ScriptLoader.loadPackage(options.prefixVersion("presentation-frontend"));
      await ScriptLoader.loadPackage(options.prefixVersion("presentation-components"));
    }
    if (options.loadUiFramework) {
      await ScriptLoader.loadPackage(options.prefixVersion("ui-ninezone"));
      await ScriptLoader.loadPackage(options.prefixVersion("ui-framework"));
    }
  }
  await cssFilesPromise;
  await ScriptLoader.loadPackage(options.prefixVersion("main"));
}

function getOptions(): IModelJsLoadOptions {
  const loaderScriptElement: HTMLScriptElement | SVGScriptElement | null = document.currentScript;
  if (!loaderScriptElement)
    return new IModelJsLoadOptions(null, null);

  const iModelJsModuleCDN = loaderScriptElement.getAttribute("data-imjsmodulecdn");

  const iModelJsVersionString = loaderScriptElement.getAttribute("data-imjsversions");
  return new IModelJsLoadOptions(iModelJsVersionString, iModelJsModuleCDN);
}

// execute the loader
function readOptionsAndLoadIModelJs() {
  const options: IModelJsLoadOptions = getOptions();
  // tslint:disable-next-line:no-console
  loadIModelJs(options).catch((_err) => { console.log("Unable to load iModel.js modules"); });
}

// entry point
readOptionsAndLoadIModelJs();
