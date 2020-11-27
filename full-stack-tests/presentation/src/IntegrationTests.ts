/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "@bentley/presentation-frontend/lib/test/_helpers/MockFrontendEnvironment";
import * as chai from "chai";
import chaiSubset from "chai-subset";
import * as cpx from "cpx";
import * as fs from "fs";
import * as path from "path";
import sinonChai from "sinon-chai";
import { ClientRequestContext, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import { IModelAppOptions, NoRenderApp } from "@bentley/imodeljs-frontend";
import { I18NOptions } from "@bentley/imodeljs-i18n";
import { TestUsers } from "@bentley/oidc-signin-tool/lib/TestUsers";
import { TestUtility } from "@bentley/oidc-signin-tool/lib/TestUtility";
import {
  HierarchyCacheMode, Presentation as PresentationBackend, PresentationBackendLoggerCategory, PresentationBackendNativeLoggerCategory,
  PresentationProps as PresentationBackendProps,
} from "@bentley/presentation-backend";
import { RequestPriority } from "@bentley/presentation-common";
import { PresentationComponentsLoggerCategory } from "@bentley/presentation-components";
import { PresentationFrontendLoggerCategory, PresentationManagerProps as PresentationFrontendProps } from "@bentley/presentation-frontend";
import { initialize as initializeTesting, PresentationTestingInitProps, terminate as terminateTesting } from "@bentley/presentation-testing";

chai.use(sinonChai);
chai.use(chaiSubset);

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
    const urlTemplate = `file://${path.join(path.resolve("lib/public/locales"), "{{lng}}/{{ns}}.json").replace(/\\/g, "/")}`;
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
  Logger.setLevelDefault(LogLevel.Warning);
  Logger.setLevel(PresentationBackendNativeLoggerCategory.ECObjects, LogLevel.Warning);
  Logger.setLevel(PresentationBackendNativeLoggerCategory.ECPresentation, LogLevel.Info);
  Logger.setLevel(PresentationBackendLoggerCategory.Package, LogLevel.Info);
  Logger.setLevel(PresentationFrontendLoggerCategory.Package, LogLevel.Info);
  Logger.setLevel(PresentationComponentsLoggerCategory.Package, LogLevel.Info);

  const backendInitProps: PresentationBackendProps = {
    requestTimeout: props.backendTimeout ?? 0,
    rulesetDirectories: ["lib/assets/rulesets"],
    localeDirectories: ["lib/assets/locales"],
    activeLocale: "en-PSEUDO",
    taskAllocationsMap: {
      [RequestPriority.Max]: 1,
    },
    cacheConfig: { mode: HierarchyCacheMode.Disk, directory: path.join("lib", "cache") },
  };
  const frontendInitProps: PresentationFrontendProps = {
    activeLocale: "en-PSEUDO",
  };

  const frontendAppOptions: IModelAppOptions = {
    authorizationClient: props.useClientServices
      ? TestUtility.getAuthorizationClient(TestUsers.regular)
      : undefined,
  };

  if (props.useClientServices)
    await frontendAppOptions.authorizationClient!.signIn(new ClientRequestContext());

  const presentationTestingInitProps: PresentationTestingInitProps = {
    backendProps: backendInitProps,
    frontendProps: frontendInitProps,
    frontendApp: IntegrationTestsApp,
    frontendAppOptions,
  };

  await initializeTesting(presentationTestingInitProps);
  console.log(`Backend PID: ${process.pid}`); // eslint-disable-line no-console
};

export const initialize = async (backendTimeout: number = 0): Promise<void> => {
  await initializeCommon({ backendTimeout });
};

export const initializeWithClientServices = async (): Promise<void> => {
  await initializeCommon({ useClientServices: true });
};

export const terminate = async (): Promise<void> => {
  await terminateTesting();
};

export const resetBackend = (): void => {
  const props = PresentationBackend.initProps;
  PresentationBackend.terminate();
  PresentationBackend.initialize(props);
};
