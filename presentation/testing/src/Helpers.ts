/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as path from "path";
import * as rimraf from "rimraf";
// common includes
import { Guid } from "@bentley/bentleyjs-core";
import { PresentationRpcInterface } from "@bentley/presentation-common";
// backend includes
import { IModelHost, KnownLocations } from "@bentley/imodeljs-backend";
import { Presentation as PresentationBackend, PresentationManagerProps as PresentationBackendProps } from "@bentley/presentation-backend";
// frontend includes
import {
  SnapshotIModelRpcInterface,
  IModelReadRpcInterface,
  RpcConfiguration,
  RpcInterfaceDefinition,
  RpcDefaultConfiguration,
} from "@bentley/imodeljs-common";
import { NoRenderApp, IModelApp } from "@bentley/imodeljs-frontend";
import { Presentation as PresentationFrontend, PresentationManagerProps as PresentationFrontendProps } from "@bentley/presentation-frontend";

function initializeRpcInterfaces(interfaces: RpcInterfaceDefinition[]) {
  const config = class extends RpcDefaultConfiguration {
    public interfaces: any = () => interfaces;
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

/**
 * Initialize the framework for presentation testing. The function sets up backend,
 * frontend and RPC communication between them.
 * @param backendProps Properties for backend initialization
 * @param frontendProps Properties for frontend initialization
 * @param frontendApp IModelApp implementation
 *
 * @see `terminate`
 *
 * @public
 */
export const initialize = (backendProps?: PresentationBackendProps, frontendProps?: PresentationFrontendProps, frontendApp = NoRenderApp) => {
  if (isInitialized)
    return;

  // make sure backend gets assigned an id which puts its resources into a unique directory
  backendProps = backendProps || {};
  if (!backendProps.id)
    backendProps.id = `test-${Guid.createValue()}`;

  // init backend
  IModelHost.startup();
  PresentationBackend.initialize(backendProps);

  // set up rpc interfaces
  initializeRpcInterfaces([SnapshotIModelRpcInterface, IModelReadRpcInterface, PresentationRpcInterface]);

  // init frontend
  frontendApp.startup();

  const defaultFrontendProps: PresentationFrontendProps = {
    activeLocale: IModelApp.i18n.languageList()[0],
  };
  PresentationFrontend.initialize({ ...defaultFrontendProps, ...frontendProps });

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
export const terminate = (frontendApp = IModelApp) => {
  if (!isInitialized)
    return;

  // store directory that needs to be cleaned-up
  const tempDirectory = (PresentationBackend.initProps && PresentationBackend.initProps.id)
    ? path.join(KnownLocations.tmpdir, "ecpresentation", PresentationBackend.initProps.id) : undefined;

  // terminate backend
  PresentationBackend.terminate();
  IModelHost.shutdown();
  if (tempDirectory)
    rimraf.sync(tempDirectory);

  // terminate frontend
  PresentationFrontend.terminate();
  frontendApp.shutdown();

  isInitialized = false;
};
