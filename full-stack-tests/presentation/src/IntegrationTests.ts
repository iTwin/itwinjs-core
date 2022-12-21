/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as cpx from "cpx2";
import * as fs from "fs";
import Backend from "i18next-http-backend";
import * as path from "path";
import { Guid, Logger, LogLevel } from "@itwin/core-bentley";
import { IModelApp, IModelAppOptions, NoRenderApp } from "@itwin/core-frontend";
import { ITwinLocalization } from "@itwin/core-i18n";
import { TestBrowserAuthorizationClient, TestUsers, TestUtility } from "@itwin/oidc-signin-tool";
import {
  HierarchyCacheMode, Presentation as PresentationBackend, PresentationBackendNativeLoggerCategory, PresentationProps as PresentationBackendProps,
} from "@itwin/presentation-backend";
import { Presentation as PresentationFrontend, PresentationProps as PresentationFrontendProps } from "@itwin/presentation-frontend";
import { IModelHost, IModelHostOptions } from "@itwin/core-backend";
import { IModelReadRpcInterface, RpcConfiguration, RpcDefaultConfiguration, RpcInterfaceDefinition, SnapshotIModelRpcInterface } from "@itwin/core-common";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import rimraf from "rimraf";

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
  public static override async startup(opts?: IModelAppOptions): Promise<void> {
    await NoRenderApp.startup(opts);
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
  Logger.setLevel("SQLite", LogLevel.Error);
  Logger.setLevel(PresentationBackendNativeLoggerCategory.ECObjects, LogLevel.Warning);

  const libDir = path.resolve("lib");
  const hierarchiesCacheDir = path.join(libDir, "cache");
  if (!fs.existsSync(hierarchiesCacheDir))
    fs.mkdirSync(hierarchiesCacheDir);

  const backendInitProps: PresentationBackendProps = {
    id: `test-${Guid.createValue()}`,
    requestTimeout: props.backendTimeout ?? 0,
    rulesetDirectories: [path.join(libDir, "assets", "rulesets")],
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
    localization: new ITwinLocalization({
      urlTemplate: `file://${path.join(path.resolve("lib/public/locales"), "{{lng}}/{{ns}}.json").replace(/\\/g, "/")}`,
      initOptions: {
        preload: ["test"],
      },
      backendHttpOptions: {
        request: (options, url, payload, callback) => {
          /**
           * A few reasons why we need to modify this request fn:
           * - The above urlTemplate uses the file:// protocol
           * - Node v18's fetch implementation does not support file://
           * - i18n-http-backend uses fetch if it defined globally
           */
          const fileProtocol = "file://";
          const request = new Backend().options.request?.bind(this as void);

          if (url.startsWith(fileProtocol)) {
            try {
              const data = fs.readFileSync(url.replace(fileProtocol, ""), "utf8");
              callback(null, { status: 200, data });
            } catch (error) {
              callback(error, { status: 500, data: "" });
            }
          } else {
            request!(options, url, payload, callback);
          }
        },
      },
    }),
  };

  if (props.useClientServices)
    await (frontendAppOptions.authorizationClient! as TestBrowserAuthorizationClient).signIn();

  const presentationTestingInitProps: PresentationInitProps = {
    backendProps: backendInitProps,
    backendHostProps: { cacheDir: path.join(__dirname, ".cache") },
    frontendProps: frontendInitProps,
    frontendApp: IntegrationTestsApp,
    frontendAppOptions,
  };

  await initializePresentation(presentationTestingInitProps);
};

export const initialize = async (backendTimeout: number = 0) => {
  await initializeCommon({ backendTimeout });
};

export const initializeWithClientServices = async () => {
  await initializeCommon({ useClientServices: true });
};

export const terminate = async () => {
  delete (global as any).requestAnimationFrame;
  await terminatePresentation();
};

export const resetBackend = () => {
  const props = PresentationBackend.initProps;
  PresentationBackend.terminate();
  PresentationBackend.initialize(props);
};

interface PresentationInitProps {
  backendProps: PresentationBackendProps;
  backendHostProps: IModelHostOptions;
  frontendProps: PresentationFrontendProps;
  frontendApp: { startup: (opts?: IModelAppOptions) => Promise<void> };
  frontendAppOptions: IModelAppOptions;
}

let isInitialized = false;
async function initializePresentation(props: PresentationInitProps) {
  if (isInitialized)
    return;

  // set up rpc interfaces
  initializeRpcInterfaces([SnapshotIModelRpcInterface, IModelReadRpcInterface, PresentationRpcInterface]);

  // init backend
  // make sure backend gets assigned an id which puts its resources into a unique directory
  await IModelHost.startup(props.backendHostProps);
  PresentationBackend.initialize(props.backendProps);

  // init frontend
  await props.frontendApp.startup(props.frontendAppOptions);
  await PresentationFrontend.initialize(props.frontendProps);

  isInitialized = true;
}

export async function terminatePresentation(frontendApp = IModelApp) {
  if (!isInitialized)
    return;

  // store directory that needs to be cleaned-up
  let hierarchiesCacheDirectory: string | undefined;
  const hierarchiesCacheConfig = PresentationBackend.initProps?.caching?.hierarchies;
  if (hierarchiesCacheConfig?.mode === HierarchyCacheMode.Disk)
    hierarchiesCacheDirectory = hierarchiesCacheConfig?.directory;
  else if (hierarchiesCacheConfig?.mode === HierarchyCacheMode.Hybrid)
    hierarchiesCacheDirectory = hierarchiesCacheConfig?.disk?.directory;

  // terminate backend
  PresentationBackend.terminate();
  await IModelHost.shutdown();
  if (hierarchiesCacheDirectory)
    rimraf.sync(hierarchiesCacheDirectory);

  // terminate frontend
  PresentationFrontend.terminate();
  await frontendApp.shutdown();

  isInitialized = false;
}

function initializeRpcInterfaces(interfaces: RpcInterfaceDefinition[]) {
  const config = class extends RpcDefaultConfiguration {
    public override interfaces: any = () => interfaces;
  };

  for (const definition of interfaces)
    RpcConfiguration.assign(definition, () => config);

  const instance = RpcConfiguration.obtain(config);

  try {
    RpcConfiguration.initializeInterfaces(instance);
  } catch {
    // this may fail with "Error: RPC interface "xxx" is already initialized." because
    // multiple different tests want to set up rpc interfaces
  }
}
