/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Helpers
 */
import * as path from "path";
import * as rimraf from "rimraf";
// common includes
import { Guid } from "@bentley/bentleyjs-core";
import { Config } from "@bentley/imodeljs-clients";
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
import { NoRenderApp, IModelApp, IModelAppOptions } from "@bentley/imodeljs-frontend";
import {
  Presentation as PresentationFrontend,
  PresentationManagerProps as PresentationFrontendProps,
  FavoritePropertiesManager,
  IFavoritePropertiesStorage,
  PropertyFullName,
  FavoritePropertiesOrderInfo,
} from "@bentley/presentation-frontend";

import { OidcAgentClientConfiguration, OidcAgentClient } from "@bentley/imodeljs-clients-backend";

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
let isFrontendAppInitialized = false;

/** @public */
export interface PresentationTestingInitProps {
  /** Properties for backend initialization */
  backendProps?: PresentationBackendProps;
  /** Properties for frontend initialization */
  frontendProps?: PresentationFrontendProps;
  /** IModelApp implementation */
  frontendApp?: { startup: (opts?: IModelAppOptions) => void };
  /** Whether to use authorization client */
  useClientServices?: boolean;
}

/**
 * Initialize the framework for presentation testing. The function sets up backend,
 * frontend and RPC communication between them.
 *
 * @see `terminate`
 *
 * @public
 */
export const initializeAsync = async (props?: PresentationTestingInitProps) => {
  if (!props)
    props = {};
  if (!props.frontendApp)
    props.frontendApp = NoRenderApp;

  if (!isFrontendAppInitialized && props.useClientServices) {
    const agentConfiguration: OidcAgentClientConfiguration = {
      clientId: Config.App.getString("imjs_agent_test_client_id"),
      clientSecret: Config.App.getString("imjs_agent_test_client_secret"),
      scope: "imodelhub rbac-user:external-client reality-data:read urlps-third-party context-registry-service:read-only imodeljs-backend-2686 product-settings-service",
    };
    const authorizationClient = new OidcAgentClient(agentConfiguration);
    await authorizationClient.getAccessToken();
    props.frontendApp.startup({ authorizationClient });
    isFrontendAppInitialized = true;
  }

  await initialize(props.backendProps, props.frontendProps, props.frontendApp);
};

const initialize = async (backendProps?: PresentationBackendProps, frontendProps?: PresentationFrontendProps, frontendApp: { startup: (opts?: IModelAppOptions) => void } = NoRenderApp) => {
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

  if (!isFrontendAppInitialized) {
    // init frontend
    frontendApp.startup();
    setCustomFavoritePropertiesManager();
    isFrontendAppInitialized = true;
  }

  const defaultFrontendProps: PresentationFrontendProps = {
    activeLocale: IModelApp.i18n.languageList()[0],
  };
  await PresentationFrontend.initialize({ ...defaultFrontendProps, ...frontendProps });

  isInitialized = true;
};

const setCustomFavoritePropertiesManager = () => {
  const storage: IFavoritePropertiesStorage = {
    loadProperties: async (_projectId?: string, _imodelId?: string) => (new Set<PropertyFullName>()),
    async saveProperties(_properties: Set<PropertyFullName>, _projectId?: string, _imodelId?: string) { },
    loadPropertiesOrder: async (_projectId?: string, _imodelId?: string) => ([]),
    async savePropertiesOrder(_orderInfos: FavoritePropertiesOrderInfo[], _projectId?: string, _imodelId?: string) { },
  };
  PresentationFrontend.favoriteProperties = new FavoritePropertiesManager({ storage });
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
  isFrontendAppInitialized = false;
};
