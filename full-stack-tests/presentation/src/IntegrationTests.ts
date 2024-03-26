/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import * as cpx from "cpx2";
import * as fs from "fs";
import Backend from "i18next-http-backend";
import * as path from "path";
import rimraf from "rimraf";
import sinon from "sinon";
import { IModelHost, IModelHostOptions, IModelJsFs } from "@itwin/core-backend";
import { Guid, Logger, LogLevel } from "@itwin/core-bentley";
import {
  AuthorizationClient,
  EmptyLocalization,
  IModelReadRpcInterface,
  Localization,
  RpcConfiguration,
  RpcDefaultConfiguration,
  RpcInterfaceDefinition,
  SnapshotIModelRpcInterface,
} from "@itwin/core-common";
import { IModelApp, IModelAppOptions, NoRenderApp } from "@itwin/core-frontend";
import { ITwinLocalization } from "@itwin/core-i18n";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { TestUsers, TestUtility } from "@itwin/oidc-signin-tool";
import {
  HierarchyCacheMode,
  Presentation as PresentationBackend,
  PresentationBackendNativeLoggerCategory,
  PresentationProps as PresentationBackendProps,
} from "@itwin/presentation-backend";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { Presentation as PresentationFrontend, PresentationProps as PresentationFrontendProps } from "@itwin/presentation-frontend";
import { getOutputRoot } from "./Utils";

const DEFAULT_BACKEND_TIMEOUT: number = 0;

/** Loads the provided `.env` file into process.env */
function loadEnv(envFile: string) {
  if (!fs.existsSync(envFile)) {
    return;
  }

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
  fs.readdirSync(iTwinPackagesPath)
    .map((packageName) => {
      const packagePath = path.resolve(iTwinPackagesPath, packageName);
      return path.join(packagePath, "lib", "cjs", "assets");
    })
    .filter((assetsPath) => {
      return fs.existsSync(assetsPath);
    })
    .forEach((src) => {
      cpx.copySync(`${src}/**/*`, outputDir);
    });
};

const copyITwinFrontendAssets = (outputDir: string) => {
  const iTwinPackagesPath = "node_modules/@itwin";
  fs.readdirSync(iTwinPackagesPath)
    .map((packageName) => {
      const packagePath = path.resolve(iTwinPackagesPath, packageName);
      return path.join(packagePath, "lib", "public");
    })
    .filter((assetsPath) => {
      return fs.existsSync(assetsPath);
    })
    .forEach((src) => {
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

/** Prepares an empty, process-unique output directory */
export function setupTestsOutputDirectory() {
  const outputRoot = getOutputRoot();
  fs.existsSync(outputRoot) && IModelJsFs.removeSync(outputRoot);
  fs.mkdirSync(outputRoot, { recursive: true });
  return outputRoot;
}

const initializeCommon = async (props: {
  backendTimeout?: number;
  frontendTimeout?: number;
  authorizationClient?: AuthorizationClient;
  localization?: Localization;
}) => {
  // init logging
  Logger.initializeToConsole();
  Logger.turnOffCategories();
  Logger.setLevelDefault(LogLevel.Warning);
  Logger.setLevel("i18n", LogLevel.Error);
  Logger.setLevel("SQLite", LogLevel.Error);
  Logger.setLevel(PresentationBackendNativeLoggerCategory.ECObjects, LogLevel.Warning);

  const outputRoot = setupTestsOutputDirectory();
  const tempCachesDir = path.join(outputRoot, "caches");
  if (!fs.existsSync(tempCachesDir)) {
    fs.mkdirSync(tempCachesDir);
  }

  const backendInitProps: PresentationBackendProps = {
    id: `test-${Guid.createValue()}`,
    requestTimeout: props.backendTimeout,
    rulesetDirectories: [path.join(path.resolve("lib"), "assets", "rulesets")],
    defaultLocale: "en-PSEUDO",
    workerThreadsCount: 1,
    caching: {
      hierarchies: {
        mode: HierarchyCacheMode.Memory,
      },
    },
  };
  const frontendInitProps: PresentationFrontendProps = {
    presentation: {
      requestTimeout: props.frontendTimeout,
      activeLocale: "en-PSEUDO",
    },
  };

  const frontendAppOptions: IModelAppOptions = {
    authorizationClient: props.authorizationClient,
    localization: props.localization ?? new EmptyLocalization(),
  };

  const presentationTestingInitProps: PresentationInitProps = {
    backendProps: backendInitProps,
    backendHostProps: { cacheDir: tempCachesDir },
    frontendProps: frontendInitProps,
    frontendApp: IntegrationTestsApp,
    frontendAppOptions,
  };

  await initializePresentation(presentationTestingInitProps);

  global.requestAnimationFrame = sinon.fake((cb: FrameRequestCallback) => {
    return window.setTimeout(cb, 0);
  });

  // eslint-disable-next-line no-console
  console.log(`[${new Date().toISOString()}] Tests initialized`);
};

export const initialize = async (props?: { backendTimeout?: number; frontendTimeout?: number; localization?: Localization }) => {
  await initializeCommon({
    backendTimeout: DEFAULT_BACKEND_TIMEOUT,
    ...props,
  });
};

export const initializeWithClientServices = async () => {
  const authorizationClient = TestUtility.getAuthorizationClient(TestUsers.regular);
  await authorizationClient.signIn();
  await initializeCommon({ authorizationClient });
};

export const terminate = async () => {
  delete (global as any).requestAnimationFrame;
  await terminatePresentation();
  // eslint-disable-next-line no-console
  console.log(`[${new Date().toISOString()}] Tests terminated`);
};

export const resetBackend = () => {
  const props = PresentationBackend.initProps;
  PresentationBackend.terminate();
  PresentationBackend.initialize(props);
};

export const testLocalization = new ITwinLocalization({
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
});

interface PresentationInitProps {
  backendProps: PresentationBackendProps;
  backendHostProps: IModelHostOptions;
  frontendProps: PresentationFrontendProps;
  frontendApp: { startup: (opts?: IModelAppOptions) => Promise<void> };
  frontendAppOptions: IModelAppOptions;
}

let isInitialized = false;
async function initializePresentation(props: PresentationInitProps) {
  if (isInitialized) {
    return;
  }

  // set up rpc interfaces
  initializeRpcInterfaces([SnapshotIModelRpcInterface, IModelReadRpcInterface, PresentationRpcInterface, ECSchemaRpcInterface]);

  // init backend
  // make sure backend gets assigned an id which puts its resources into a unique directory
  await IModelHost.startup(props.backendHostProps);
  PresentationBackend.initialize(props.backendProps);
  ECSchemaRpcImpl.register();

  // init frontend
  await props.frontendApp.startup(props.frontendAppOptions);
  await PresentationFrontend.initialize(props.frontendProps);

  isInitialized = true;
}

async function terminatePresentation(frontendApp = IModelApp) {
  if (!isInitialized) {
    return;
  }

  // store directory that needs to be cleaned-up
  let hierarchiesCacheDirectory: string | undefined;
  const hierarchiesCacheConfig = PresentationBackend.initProps?.caching?.hierarchies;
  if (hierarchiesCacheConfig?.mode === HierarchyCacheMode.Disk) {
    hierarchiesCacheDirectory = hierarchiesCacheConfig?.directory;
  } else if (hierarchiesCacheConfig?.mode === HierarchyCacheMode.Hybrid) {
    hierarchiesCacheDirectory = hierarchiesCacheConfig?.disk?.directory;
  }

  // terminate backend
  PresentationBackend.terminate();
  await IModelHost.shutdown();
  if (hierarchiesCacheDirectory) {
    rimraf.sync(hierarchiesCacheDirectory);
  }

  // terminate frontend
  PresentationFrontend.terminate();
  await frontendApp.shutdown();

  isInitialized = false;
}

function initializeRpcInterfaces(interfaces: RpcInterfaceDefinition[]) {
  const config = class extends RpcDefaultConfiguration {
    public override interfaces: any = () => interfaces;
  };

  for (const definition of interfaces) {
    RpcConfiguration.assign(definition, () => config);
  }

  const instance = RpcConfiguration.obtain(config);

  try {
    RpcConfiguration.initializeInterfaces(instance);
  } catch {
    // this may fail with "Error: RPC interface "xxx" is already initialized." because
    // multiple different tests want to set up rpc interfaces
  }
}
