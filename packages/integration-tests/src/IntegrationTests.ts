/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import * as path from "path";
import * as cpx from "cpx";
import "@helpers/MockFrontendEnvironment";
// common includes
import { I18NOptions } from "@bentley/imodeljs-i18n";
import TestRpcManager from "@helpers/TestRpcManager";
// backend includes
import { IModelHost } from "@bentley/imodeljs-backend";
import { ECPresentation as ECPresentationBackend, ECPresentation } from "@bentley/ecpresentation-backend";
// frontend includes
import { StandaloneIModelRpcInterface, IModelReadRpcInterface } from "@bentley/imodeljs-common";
import { ECPresentationRpcInterface } from "@bentley/ecpresentation-common";
import { NoRenderApp } from "@bentley/imodeljs-frontend";
import { ECPresentation as ECPresentationFrontend } from "@bentley/ecpresentation-frontend";

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

  // init backend
  IModelHost.startup();
  ECPresentationBackend.initialize({
    rulesetDirectories: ["lib/assets/rulesets"],
    localeDirectories: ["lib/assets/locales"],
  });

  // set up rpc interfaces
  TestRpcManager.initializeClient([StandaloneIModelRpcInterface, IModelReadRpcInterface, ECPresentationRpcInterface]);

  // init frontend
  IntegrationTestsApp.startup();
  ECPresentationFrontend.initialize({
    activeLocale: IntegrationTestsApp.i18n.languageList()[0],
  });

  isInitialized = true;
};

export const terminate = () => {
  if (!isInitialized)
    return;

  // terminate backend
  ECPresentation.terminate();
  IModelHost.shutdown();

  // terminate frontend
  ECPresentation.terminate();
  NoRenderApp.shutdown();

  isInitialized = false;
};
