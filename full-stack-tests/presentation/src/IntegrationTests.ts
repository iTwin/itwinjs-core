/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import Backend from "i18next-http-backend";
import * as path from "path";
import { rimrafSync } from "rimraf";
import sinon from "sinon";
import { IModelHost, IModelHostOptions, IModelJsFs } from "@itwin/core-backend";
import { Guid, Logger, LogLevel } from "@itwin/core-bentley";
import { EmptyLocalization, IModelReadRpcInterface, RpcConfiguration, RpcDefaultConfiguration, RpcInterfaceDefinition } from "@itwin/core-common";
import { IModelApp, IModelAppOptions, NoRenderApp } from "@itwin/core-frontend";
import { ITwinLocalization } from "@itwin/core-i18n";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
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

  const dotenv = require("dotenv"); // eslint-disable-line @typescript-eslint/no-require-imports
  const dotenvExpand = require("dotenv-expand"); // eslint-disable-line @typescript-eslint/no-require-imports
  const envResult = dotenv.config({ path: envFile });
  if (envResult.error) {
    throw envResult.error;
  }

  dotenvExpand(envResult);
}

loadEnv(path.join(__dirname, "..", ".env"));

class IntegrationTestsApp extends NoRenderApp {
  public static override async startup(opts?: IModelAppOptions): Promise<void> {
    await NoRenderApp.startup(opts);
    await IModelApp.localization.changeLanguage("en-PSEUDO");
  }
}

/** Prepares an empty, process-unique output directory */
export function setupTestsOutputDirectory() {
  const outputRoot = getOutputRoot();
  fs.existsSync(outputRoot) && IModelJsFs.removeSync(outputRoot);
  fs.mkdirSync(outputRoot, { recursive: true });
  return outputRoot;
}

export const initialize = async (props?: {
  presentationBackendProps?: PresentationBackendProps;
  presentationFrontendProps?: PresentationFrontendProps;
  imodelAppProps?: IModelAppOptions;
}) => {
  // init logging
  Logger.initializeToConsole();
  Logger.turnOffCategories();
  Logger.setLevelDefault(LogLevel.Warning);
  Logger.setLevel("i18n", LogLevel.Error);
  Logger.setLevel("SQLite", LogLevel.Error);
  Logger.setLevel(PresentationBackendNativeLoggerCategory.ECObjects, LogLevel.Warning);

  const outputRoot = setupTestsOutputDirectory();

  const backendInitProps: PresentationBackendProps = {
    id: `test-${Guid.createValue()}`,
    requestTimeout: DEFAULT_BACKEND_TIMEOUT,
    rulesetDirectories: [path.join(path.resolve("lib"), "assets", "rulesets")],
    defaultLocale: "en-PSEUDO",
    workerThreadsCount: 1,
    caching: {
      hierarchies: {
        mode: HierarchyCacheMode.Memory,
      },
    },
    ...props?.presentationBackendProps,
  };
  const frontendInitProps: PresentationFrontendProps = {
    presentation: {
      activeLocale: "en-PSEUDO",
    },
    ...props?.presentationFrontendProps,
  };

  const frontendAppOptions: IModelAppOptions = {
    localization: new EmptyLocalization(),
    ...props?.imodelAppProps,
  };

  const presentationTestingInitProps: PresentationInitProps = {
    backendProps: backendInitProps,
    backendHostProps: { cacheDir: outputRoot },
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
  initializeRpcInterfaces([IModelReadRpcInterface, PresentationRpcInterface, ECSchemaRpcInterface]);

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
    rimrafSync(hierarchiesCacheDirectory);
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
