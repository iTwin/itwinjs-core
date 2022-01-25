/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "@itwin/presentation-frontend/lib/cjs/test/_helpers/MockFrontendEnvironment";
import * as chai from "chai";
import chaiSubset from "chai-subset";
import * as cpx from "cpx2";
import * as fs from "fs";
import * as path from "path";
import sinonChai from "sinon-chai";
import { Logger, LogLevel } from "@itwin/core-bentley";
import { IModelApp, IModelAppOptions, NoRenderApp } from "@itwin/core-frontend";
import { ITwinLocalization } from "@itwin/core-i18n";
import { TestBrowserAuthorizationClient, TestUsers, TestUtility } from "@itwin/oidc-signin-tool";
import {
  HierarchyCacheMode, Presentation as PresentationBackend, PresentationBackendNativeLoggerCategory, PresentationProps as PresentationBackendProps,
} from "@itwin/presentation-backend";
import { PresentationProps as PresentationFrontendProps } from "@itwin/presentation-frontend";
import { initialize as initializeTesting, PresentationTestingInitProps, terminate as terminateTesting } from "@itwin/presentation-testing";

/** Loads the provided `.env` file into process.env */
function loadEnv(envFile: string) {
  if (!fs.existsSync(envFile))
    return;

  const dotenv = require("dotenv"); // eslint-disable-line @typescript-eslint/no-var-requires
  const dotenvExpand = require("dotenv-expand"); // eslint-disable-line @typescript-eslint/no-var-requires
  const envResult = dotenv.config({ path: envFile });
  if (envResult.error) {
    throw envResult.error;
  }

  dotenvExpand(envResult);
}

chai.use(sinonChai);
chai.use(chaiSubset);

loadEnv(path.join(__dirname, "..", ".env"));

const copyITwinBackendAssets = (outputDir: string) => {
  const iTwinPackagesPath = "node_modules/@itwin";
  fs.readdirSync(iTwinPackagesPath).map((packageName) => {
    const packagePath = path.resolve(iTwinPackagesPath, packageName);
    return path.join(packagePath, "lib", "cjs", "assets");
  }).filter((assetsPath) => {
    return fs.existsSync(assetsPath);
  }).forEach((src) => {
    cpx.copySync(`${src}/**/*`, outputDir);
  });
};

const copyITwinFrontendAssets = (outputDir: string) => {
  const iTwinPackagesPath = "node_modules/@itwin";
  fs.readdirSync(iTwinPackagesPath).map((packageName) => {
    const packagePath = path.resolve(iTwinPackagesPath, packageName);
    return path.join(packagePath, "lib", "public");
  }).filter((assetsPath) => {
    return fs.existsSync(assetsPath);
  }).forEach((src) => {
    cpx.copySync(`${src}/**/*`, outputDir);
  });
};

class IntegrationTestsApp extends NoRenderApp {
  protected static supplyUrlTemplate(): string {
    return `file://${path.join(path.resolve("lib/public/locales"), "{{lng}}/{{ns}}.json").replace(/\\/g, "/")}`;
  }

  public static override async startup(opts?: IModelAppOptions): Promise<void> {
    await NoRenderApp.startup({ ...opts, localization: new ITwinLocalization({ urlTemplate: this.supplyUrlTemplate() }) });
    await IModelApp.localization.changeLanguage("en-PSEUDO");
    cpx.copySync(`assets/**/*`, "lib/assets");
    copyITwinBackendAssets("lib/assets");
    copyITwinFrontendAssets("lib/public");
  }
}

const initializeCommon = async (props: { backendTimeout?: number, useClientServices?: boolean }) => {
  // init logging
  Logger.initializeToConsole();
  Logger.setLevelDefault(LogLevel.Warning);
  Logger.setLevel("i18n", LogLevel.Error);
  Logger.setLevel(PresentationBackendNativeLoggerCategory.ECObjects, LogLevel.Warning);

  const libDir = path.resolve("lib");
  const hierarchiesCacheDir = path.join(libDir, "cache");
  if (!fs.existsSync(hierarchiesCacheDir))
    fs.mkdirSync(hierarchiesCacheDir);

  const backendInitProps: PresentationBackendProps = {
    requestTimeout: props.backendTimeout ?? 0,
    rulesetDirectories: [path.join(libDir, "assets", "rulesets")],
    localeDirectories: [path.join(libDir, "assets", "locales")],
    defaultLocale: "en-PSEUDO",
    workerThreadsCount: 1,
    caching: {
      hierarchies: {
        mode: HierarchyCacheMode.Disk,
        directory: hierarchiesCacheDir,
      },
    },
  };
  const frontendInitProps: PresentationFrontendProps = {
    presentation: {
      activeLocale: "en-PSEUDO",
    },
  };

  const frontendAppOptions: IModelAppOptions = {
    authorizationClient: props.useClientServices
      ? TestUtility.getAuthorizationClient(TestUsers.regular)
      : undefined,
  };

  if (props.useClientServices)
    await (frontendAppOptions.authorizationClient! as TestBrowserAuthorizationClient).signIn();

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
