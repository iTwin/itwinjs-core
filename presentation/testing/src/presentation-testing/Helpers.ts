/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Helpers
 */
import * as rimraf from "rimraf";
// common includes
import { Guid } from "@itwin/core-bentley";
// backend includes
import { IModelHost } from "@itwin/core-backend";
// frontend includes
import {
  IModelReadRpcInterface, RpcConfiguration, RpcDefaultConfiguration, RpcInterfaceDefinition, SnapshotIModelRpcInterface,
} from "@itwin/core-common";
import { IModelApp, IModelAppOptions, NoRenderApp } from "@itwin/core-frontend";
import { HierarchyCacheMode, Presentation as PresentationBackend, PresentationManagerProps as PresentationBackendProps, PresentationManagerMode } from "@itwin/presentation-backend";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { Presentation as PresentationFrontend, PresentationProps as PresentationFrontendProps } from "@itwin/presentation-frontend";

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

export { HierarchyCacheMode, PresentationManagerMode, PresentationBackendProps };

/** @public */
export interface PresentationTestingInitProps {
  /** Properties for backend initialization */
  backendProps?: PresentationBackendProps;
  /** Properties for frontend initialization */
  frontendProps?: PresentationFrontendProps;
  /** IModelApp implementation */
  frontendApp?: { startup: (opts?: IModelAppOptions) => Promise<void> };
  /** IModelApp options */
  frontendAppOptions?: IModelAppOptions;
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

  // init backend
  // make sure backend gets assigned an id which puts its resources into a unique directory
  props.backendProps = props.backendProps ?? {};
  if (!props.backendProps.id)
    props.backendProps.id = `test-${Guid.createValue()}`;
  await IModelHost.startup();
  PresentationBackend.initialize(props.backendProps);

  // set up rpc interfaces
  initializeRpcInterfaces([SnapshotIModelRpcInterface, IModelReadRpcInterface, PresentationRpcInterface]);

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
