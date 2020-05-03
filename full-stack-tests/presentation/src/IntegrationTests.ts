/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// tslint:disable:no-direct-imports
import "@bentley/presentation-frontend/lib/test/_helpers/MockFrontendEnvironment";
import * as chai from "chai";
import * as cpx from "cpx";
import * as fs from "fs";
import * as path from "path";
import sinonChai from "sinon-chai";
import { Logger, LogLevel } from "@bentley/bentleyjs-core";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import { IModelAppOptions, NoRenderApp } from "@bentley/imodeljs-frontend";
import { I18NOptions } from "@bentley/imodeljs-i18n";
import { TestUsers } from "@bentley/oidc-signin-tool/lib/TestUsers";
import { TestUtility } from "@bentley/oidc-signin-tool/lib/TestUtility";
import { Presentation as PresentationBackend, PresentationProps as PresentationBackendProps } from "@bentley/presentation-backend";
import { LoggingNamespaces, RequestPriority } from "@bentley/presentation-common";
import { PresentationManagerProps as PresentationFrontendProps } from "@bentley/presentation-frontend";
import { initialize as initializeTesting, PresentationTestingInitProps, terminate as terminateTesting } from "@bentley/presentation-testing";

chai.use(sinonChai);

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

  public static async startup(opts?: IModelAppOptions): Promise<void> {
    await NoRenderApp.startup({ ...opts, i18n: this.supplyI18NOptions() });
    cpx.copySync(`assets/**/*`, "lib/assets");
    copyBentleyBackendAssets("lib/assets");
    copyBentleyFrontendAssets("lib/public");
  }
}

const initializeCommon = async (props: { backendTimeout?: number, useClientServices?: boolean }) => {
  // init logging
  Logger.initializeToConsole();
  Logger.setLevelDefault(LogLevel.Error);
  Logger.setLevel(LoggingNamespaces.ECObjects_ECExpressions, LogLevel.Warning);
  Logger.setLevel(LoggingNamespaces.ECPresentation, LogLevel.Warning);

  const backendInitProps: PresentationBackendProps = {
    requestTimeout: props.backendTimeout ?? 0,
    rulesetDirectories: ["lib/assets/rulesets"],
    localeDirectories: ["lib/assets/locales"],
    activeLocale: "en-PSEUDO",
    taskAllocationsMap: {
      [RequestPriority.Max]: 1,
    },
    cacheDirectory: path.join("lib", "cache"),
  };
  const frontendInitProps: PresentationFrontendProps = {
    activeLocale: "en-PSEUDO",
  };

  const frontendAppOptions: IModelAppOptions = {
    authorizationClient: props.useClientServices
      ? TestUtility.getAuthorizationClient(TestUsers.regular)
      : undefined,
  };

  const presentationTestingInitProps: PresentationTestingInitProps = {
    backendProps: backendInitProps,
    frontendProps: frontendInitProps,
    frontendApp: IntegrationTestsApp,
    frontendAppOptions,
  };

  await initializeTesting(presentationTestingInitProps);
};

export const initialize = async (backendTimeout: number = 0) => {
  await initializeCommon({ backendTimeout });
};

export const initializeWithClientServices = async () => {
  await initializeCommon({ useClientServices: true });
};

export const terminate = async () => {
  await terminateTesting();
};

export const resetBackend = () => {
  const props = PresentationBackend.initProps;
  PresentationBackend.terminate();
  PresentationBackend.initialize(props);
};
