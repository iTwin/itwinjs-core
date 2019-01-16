/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as path from "path";
import * as rimraf from "rimraf";
// common includes
import { PresentationRpcInterface } from "@bentley/presentation-common";
// backend includes
import { IModelHost, KnownLocations } from "@bentley/imodeljs-backend";
import { Presentation as PresentationBackend } from "@bentley/presentation-backend";
import { Props as PresentationBackendProps } from "@bentley/presentation-backend/lib/Presentation";
// frontend includes
import {
  StandaloneIModelRpcInterface,
  IModelReadRpcInterface,
  RpcConfiguration,
  RpcInterfaceDefinition,
  RpcDefaultConfiguration,
} from "@bentley/imodeljs-common";
import { NoRenderApp } from "@bentley/imodeljs-frontend";
import { Presentation as PresentationFrontend } from "@bentley/presentation-frontend";

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

export const initialize = (backendProps?: PresentationBackendProps, frontendApp = NoRenderApp) => {
  if (isInitialized)
    return;

  // clean up temp directory to make sure we start from scratch
  rimraf.sync(path.join(KnownLocations.tmpdir, "ecpresentation"));

  // init backend
  IModelHost.startup();
  PresentationBackend.initialize(backendProps);

  // set up rpc interfaces
  initializeRpcInterfaces([StandaloneIModelRpcInterface, IModelReadRpcInterface, PresentationRpcInterface]);

  // init frontend
  frontendApp.startup();
  PresentationFrontend.initialize({
    activeLocale: frontendApp.i18n.languageList()[0],
  });

  isInitialized = true;
};

export const terminate = (frontendApp = NoRenderApp) => {
  if (!isInitialized)
    return;

  // terminate backend
  PresentationBackend.terminate();
  IModelHost.shutdown();

  // terminate frontend
  PresentationFrontend.terminate();
  frontendApp.shutdown();

  isInitialized = false;
};
