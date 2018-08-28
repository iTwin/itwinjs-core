/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import * as path from "path";
import * as cpx from "cpx";
import * as rimraf from "rimraf";
import "@helpers/MockFrontendEnvironment";
// common includes
import { I18NOptions } from "@bentley/imodeljs-i18n";
import { Logger, LogLevel } from "@bentley/bentleyjs-core";
import { LoggingNamespaces } from "@bentley/presentation-common";
import TestRpcManager from "@helpers/TestRpcManager";
// backend includes
import { IModelHost, KnownLocations } from "@bentley/imodeljs-backend";
import { Presentation as PresentationBackend, Presentation } from "@bentley/presentation-backend";
// frontend includes
import { StandaloneIModelRpcInterface, IModelReadRpcInterface } from "@bentley/imodeljs-common";
import { PresentationRpcInterface } from "@bentley/presentation-common";
import { NoRenderApp } from "@bentley/imodeljs-frontend";
import { Presentation as PresentationFrontend } from "@bentley/presentation-frontend";

process.env.NODE_ENV = "development";
let isInitialized = false;

const copyBentleyBackendAssets = (outputDir: string) => {
  const bentleyPackagesPath = "node_modules/@bentley";
  fs.readdirSync(bentleyPackagesPath).map((packageName) => {
    const packagePath = path.resolve(bentleyPackagesPath, packageName);
    return path.join(packagePath, "lib", "assets");
  }).filter((assetsPath) => {
    return fs.existsSync(assetsPath);
  }).forEach((src) => {
    cpx.copySync(`${src}/**/*`, outputDir);
  });
};

const copyBentleyFrontendAssets = (outputDir: string) => {
  const bentleyPackagesPath = "node_modules/@bentley";
  fs.readdirSync(bentleyPackagesPath).map((packageName) => {
    const packagePath = path.resolve(bentleyPackagesPath, packageName);
    return path.join(packagePath, "lib", "public");
  }).filter((assetsPath) => {
    return fs.existsSync(assetsPath);
  }).forEach((src) => {
    cpx.copySync(`${src}/**/*`, outputDir);
  });
};

class IntegrationTestsApp extends NoRenderApp {
  protected static supplyI18NOptions(): I18NOptions {
    const urlTemplate = `file://${path.resolve("lib/public/locales")}/{{lng}}/{{ns}}.json`;
    return { urlTemplate };
  }
  protected static onStartup(): void {
    cpx.copySync(`assets/**/*`, "lib/assets");
    copyBentleyBackendAssets("lib/assets");
    copyBentleyFrontendAssets("lib/public");
  }
}

export const initialize = () => {
  if (isInitialized)
    return;

  // clean up temp directory to make sure we start from scratch
  rimraf.sync(path.join(KnownLocations.tmpdir, "ecpresentation"));

  // init logging (enable on demand while debugging)
  Logger.initializeToConsole();
  Logger.setLevel(LoggingNamespaces.ECObjects_ECExpressions, LogLevel.None);
  Logger.setLevel(LoggingNamespaces.ECPresentation, LogLevel.None);

  // init backend
  IModelHost.startup();
  PresentationBackend.initialize({
    rulesetDirectories: ["lib/assets/rulesets"],
    localeDirectories: ["lib/assets/locales"],
  });

  // set up rpc interfaces
  TestRpcManager.initializeClient([StandaloneIModelRpcInterface, IModelReadRpcInterface, PresentationRpcInterface]);

  // init frontend
  IntegrationTestsApp.startup();
  PresentationFrontend.initialize({
    activeLocale: IntegrationTestsApp.i18n.languageList()[0],
  });

  isInitialized = true;
};

export const terminate = () => {
  if (!isInitialized)
    return;

  // terminate backend
  Presentation.terminate();
  IModelHost.shutdown();

  // terminate frontend
  Presentation.terminate();
  NoRenderApp.shutdown();

  isInitialized = false;
};
