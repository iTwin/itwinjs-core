/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Helpers
 */
/* istanbul ignore file */  // TODO: Remove istanbul ignore file when https://github.com/iTwin/itwinjs-backlog/issues/463 is fixed.
import { join } from "path";
import * as rimraf from "rimraf";
import { IModelHost, IModelHostOptions } from "@itwin/core-backend";
import { Guid } from "@itwin/core-bentley";
import {
  IModelReadRpcInterface, RpcConfiguration, RpcDefaultConfiguration, RpcInterfaceDefinition, SnapshotIModelRpcInterface,
} from "@itwin/core-common";
import { IModelApp, IModelAppOptions, NoRenderApp } from "@itwin/core-frontend";
import {
  HierarchyCacheMode, Presentation as PresentationBackend, PresentationManagerProps as PresentationBackendProps, PresentationManagerMode,
} from "@itwin/presentation-backend";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { Presentation as PresentationFrontend, PresentationProps as PresentationFrontendProps } from "@itwin/presentation-frontend";
import { tmpdir } from "os";

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

let isInitialized = false;

const defaultTestOutputDir = tmpdir();
let testOutputDir: string | undefined;

/** @internal */
export const getTestOutputDir = (): string => {
  return testOutputDir ?? defaultTestOutputDir;
};

// eslint-disable-next-line deprecation/deprecation
export { HierarchyCacheMode, PresentationManagerMode, PresentationBackendProps };

/** @public */
export interface PresentationTestingInitProps {
  /** Properties for backend initialization */
  backendProps?: PresentationBackendProps;
  /** Properties for `IModelHost` */
  backendHostProps?: IModelHostOptions;
  /** Properties for frontend initialization */
  frontendProps?: PresentationFrontendProps;
  /** IModelApp implementation */
  frontendApp?: { startup: (opts?: IModelAppOptions) => Promise<void> };
  /** `IModelApp` options */
  frontendAppOptions?: IModelAppOptions;
  /** Custom test output directory. Defaults to temporary directory provided by the OS. */
  testOutputDir?: string;
}

/**
 * Initialize the framework for presentation testing. The function sets up backend,
 * frontend and RPC communication between them.
 *
 * @see `terminate`
 *
 * @public
 */
export const initialize = async (props?: PresentationTestingInitProps) => {
  if (isInitialized)
    return;

  if (!props)
    props = {};

  // set up rpc interfaces
  initializeRpcInterfaces([SnapshotIModelRpcInterface, IModelReadRpcInterface, PresentationRpcInterface]);

  // init backend
  // make sure backend gets assigned an id which puts its resources into a unique directory
  props.backendProps = props.backendProps ?? {};
  if (!props.backendProps.id)
    props.backendProps.id = `test-${Guid.createValue()}`;
  await IModelHost.startup({ cacheDir: join(__dirname, ".cache"), ...props.backendHostProps });
  PresentationBackend.initialize(props.backendProps);

  // init frontend
  if (!props.frontendApp)
    props.frontendApp = NoRenderApp;
  await props.frontendApp.startup(props.frontendAppOptions);
  const defaultFrontendProps: PresentationFrontendProps = {
    presentation: {
      activeLocale: IModelApp.localization.getLanguageList()[0],
    },
  };
  await PresentationFrontend.initialize({ ...defaultFrontendProps, ...props.frontendProps });
  testOutputDir = props.testOutputDir;

  isInitialized = true;
};

/**
 * Undoes the setup made by `initialize`.
 * @param frontendApp IModelApp implementation
 *
 * @see `initialize`
 *
 * @public
 */
export const terminate = async (frontendApp = IModelApp) => {
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
};
