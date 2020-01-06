/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// tslint:disable:no-direct-imports
import * as fs from "fs";
import * as path from "path";
import * as cpx from "cpx";
import "@bentley/presentation-frontend/lib/test/_helpers/MockFrontendEnvironment";
import { I18NOptions } from "@bentley/imodeljs-i18n";
import { Logger, LogLevel } from "@bentley/bentleyjs-core";
import { LoggingNamespaces, RequestPriority } from "@bentley/presentation-common";
import { PresentationProps as PresentationBackendProps } from "@bentley/presentation-backend";
import { PresentationManagerProps as PresentationFrontendProps } from "@bentley/presentation-frontend";
import { NoRenderApp, IModelAppOptions } from "@bentley/imodeljs-frontend";
import { initializeAsync as initializeTesting, terminate as terminateTesting, PresentationTestingInitProps } from "@bentley/presentation-testing";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";

process.env.NODE_ENV = "development";

IModelJsConfig.init(true);

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
    const urlTemplate = "file://" + path.join(path.resolve("lib/public/locales"), "{{lng}}/{{ns}}.json").replace(/\\/g, "/");
    return { urlTemplate };
  }

  public static startup(opts?: IModelAppOptions) {
    NoRenderApp.startup({ ...opts, i18n: this.supplyI18NOptions() });
    cpx.copySync(`assets/**/*`, "lib/assets");
    copyBentleyBackendAssets("lib/assets");
    copyBentleyFrontendAssets("lib/public");
  }
}

export const initialize = async (backendTimeout: number = 0) => {
  // init logging
  Logger.initializeToConsole();
  Logger.setLevelDefault(LogLevel.Error);
  Logger.setLevel(LoggingNamespaces.ECObjects_ECExpressions, LogLevel.Warning);
  Logger.setLevel(LoggingNamespaces.ECPresentation, LogLevel.Warning);

  const backendInitProps: PresentationBackendProps = {
    requestTimeout: backendTimeout,
    rulesetDirectories: ["lib/assets/rulesets"],
    localeDirectories: ["lib/assets/locales"],
    activeLocale: "en-PSEUDO",
    taskAllocationsMap: {
      [RequestPriority.Max]: 1,
    },
  };
  const frontendInitProps: PresentationFrontendProps = {
    activeLocale: "en-PSEUDO",
  };

  const presentationTestingInitProps: PresentationTestingInitProps = {
    backendProps: backendInitProps,
    frontendProps: frontendInitProps,
    frontendApp: IntegrationTestsApp,
    useClientServices: true,
  };

  await initializeTesting(presentationTestingInitProps);
};

export const terminate = () => {
  terminateTesting();
};
