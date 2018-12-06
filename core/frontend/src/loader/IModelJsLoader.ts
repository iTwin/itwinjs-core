/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ModuleLoader */

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
  public static async loadPackage(packageName: string): Promise<void> {
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

  // loads an array of packages in parallel. Promise is resolved when all are loaded.
  // The packages can be loaded in any order, so they must be independent of each other.
  public static async loadPackagesParallel(packages: string[]): Promise<void[]> {
    const promises: Array<Promise<void>> = new Array<Promise<void>>();
    for (const thisPackage of packages) {
      promises.push(this.loadPackage(thisPackage));
    }
    return Promise.all(promises);
  }
}

// Load Options. Loading the UiComponents and UiFramework are optiona.
class IModelJsLoadOptions {
  public iModelJsVersion: string;
  public loadUiComponents: boolean;
  public loadUiFramework: boolean;

  constructor(iModelJsVersion: string, loadUiComponents: boolean, loadUiFramework: boolean) {
    this.iModelJsVersion = "v".concat(iModelJsVersion, "/");
    this.loadUiComponents = loadUiComponents || loadUiFramework;
    this.loadUiFramework = loadUiFramework;
  }
  public prefixVersion(packageName: string): string {
    return this.iModelJsVersion.concat(packageName);
  }
}

// loads the iModelJs modules, and the external modules that they depend on.
export async function loadIModelJs(options: IModelJsLoadOptions): Promise<void> {
  // if we are going to load the ui modules, get the third party stuff started now. They don't depend on any of our modules so can be loaded at any time.
  let thirdPartyRootPromise;
  if (options.loadUiComponents)
    thirdPartyRootPromise = ScriptLoader.loadPackagesParallel(["lodash.js", "react.js", "redux.js", "bwc.js"]);

  // load the lowest level stuff. geometry-core doesn't depend on bentleyjs-core, so they can be loaded together.
  await ScriptLoader.loadPackagesParallel([options.prefixVersion("bentleyjs-core.js"), options.prefixVersion("geometry-core.js")]);
  await ScriptLoader.loadPackage(options.prefixVersion("imodeljs-i18n.js"));
  await ScriptLoader.loadPackage(options.prefixVersion("imodeljs-clients.js"));
  await ScriptLoader.loadPackage(options.prefixVersion("imodeljs-common.js"));
  await ScriptLoader.loadPackage(options.prefixVersion("imodeljs-quantity.js"));
  await ScriptLoader.loadPackage(options.prefixVersion("imodeljs-frontend.js"));
  if (options.loadUiComponents) {
    await thirdPartyRootPromise;
    // load the rest of the third party modules that depend on react and redux.
    await ScriptLoader.loadPackagesParallel(["react-dom.js", "inspire-tree.js", "react-dnd.js", "react-dnd-html5-backend.js", "react-redux.js"]);
    await ScriptLoader.loadPackage(options.prefixVersion("ui-core.js"));
    await ScriptLoader.loadPackage(options.prefixVersion("ui-components.js"));
    if (options.loadUiFramework) {
      await ScriptLoader.loadPackage(options.prefixVersion("ui-ninezone.js"));
      await ScriptLoader.loadPackage(options.prefixVersion("presentation-common.js"));
      await ScriptLoader.loadPackage(options.prefixVersion("presentation-frontend.js"));
      await ScriptLoader.loadPackage(options.prefixVersion("presentation-components.js"));
      await ScriptLoader.loadPackage(options.prefixVersion("ui-framework.js"));
    }
  }
  await ScriptLoader.loadPackage("main.js");
}

// interprets string from options specification
function stringToBoolean(value: string | null, defaultValue: boolean): boolean {
  if (!value)
    return defaultValue;
  return (value !== "false") && (value !== "FALSE") && (value !== "0");
}

// retrieves the options from the script tag, using the "data-" attribute capability.
function getOptions(): IModelJsLoadOptions {
  const loaderScriptElement: HTMLScriptElement | SVGScriptElement | null = document.currentScript;
  if (!loaderScriptElement)
    return new IModelJsLoadOptions("-latest", true, true);

  const iModelJsVersion = loaderScriptElement.getAttribute("data-imjsversion");
  const loadComponentsString = loaderScriptElement.getAttribute("data-uicomponents");
  const loadFrameworkString = loaderScriptElement.getAttribute("data-uiframework");
  return new IModelJsLoadOptions(iModelJsVersion ? iModelJsVersion : "-latest", stringToBoolean(loadComponentsString, true), stringToBoolean(loadFrameworkString, true));
}

// execute the loader
function readOptionsAndLoadIModelJs() {
  const options: IModelJsLoadOptions = getOptions();
  // tslint:disable-next-line:no-console
  loadIModelJs(options).catch((_err) => { console.log("Unable to load iModel.js modules"); });
}

// entry point
readOptionsAndLoadIModelJs();
