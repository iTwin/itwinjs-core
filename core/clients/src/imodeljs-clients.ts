/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
export * from "./ECJsonTypeMap";
export * from "./Client";
export * from "./Config";
export * from "./Token";
export * from "./UserInfo";
export * from "./ConnectClients";
export * from "./WsgClient";
export * from "./FileHandler";
export * from "./IModelClient";
export * from "./ImsClients";
export * from "./Config";
export * from "./Request";
export * from "./RealityDataServicesClient";
export * from "./SettingsAdmin";
export * from "./SettingsClient";

export * from "./IModelBank/IModelBankClient";
export * from "./IModelBank/IModelBankHandler";
export * from "./IModelBank/IModelBankFileSystemContextClient";

export * from "./imodelhub/BaseHandler";
export * from "./imodelhub/Client";
export * from "./imodelhub/Query";
export * from "./imodelhub/Errors";
export * from "./imodelhub/Briefcases";
export * from "./imodelhub/ChangeSets";
export * from "./imodelhub/Codes";
export * from "./imodelhub/Events";
export * from "./imodelhub/GlobalEvents";
export * from "./imodelhub/iModels";
export * from "./imodelhub/Locks";
export * from "./imodelhub/Users";
export * from "./imodelhub/Versions";
export * from "./imodelhub/Thumbnails";

export * from "./oidc/OidcClient";
export * from "./oidc/OidcFrontendClient";
export * from "./oidc/AngularOidcFrontendClient";

export * from "./ulas/LogEntryConverter";
export * from "./ulas/UlasClient";

// Set the version number so it can be found at runtime. BUILD_SEMVER is replaced at build time by the webpack DefinePlugin.
declare var BUILD_SEMVER: string;
if ((typeof (BUILD_SEMVER) !== "undefined") && (typeof window !== "undefined") && window) {
  if (!(window as any).iModelJsVersions)
    (window as any).iModelJsVersions = new Map<string, string>();
  (window as any).iModelJsVersions.set("imodeljs-clients", BUILD_SEMVER);
}

/** @docs-package-description
 * The imodeljs-clients package allows sending requests to various CONNECT services.
 *
 * It works both on [backend]($docs/learning/backend/index.md) and [frontend]($docs/learning/frontend/index.md).
 */
/**
 * @docs-group-description Authentication
 * Classes for managing [AccessToken]($clients) used for all requests in other classes.
 */
/**
 * @docs-group-description BaseClients
 * Base classes for creating service clients.
 */
/**
 * @docs-group-description ConnectServices
 * Classes for communicating with various CONNECT services.
 */
/**
 * @docs-group-description iModelHub
 * Classes for communicating directly with [iModelHub]($docs/learning/iModelHub/index.md).
 */
/**
 * @docs-group-description iModelHubEvents
 * Classes for receiving [IModelHubEvent]($clients)s. See [working with events]($docs/learning/iModelHub/Events).
 */
/**
 * @docs-group-description iModelHubGlobalEvents
 * Classes for receiving [IModelHubGlobalEvent]($clients)s. See [working with global events]($docs/learning/iModelHub/GlobalEvents). **Currently only available to internal Bentley products.**
 */
/**
 * @docs-group-description iModels
 * Classes for abstracting access to [iModelHub]($docs/learning/iModelHub/index.md). See [iModelBank]($docs/reference/imodeljs-clients/imodelbank).
 */
/**
 * @docs-group-description Settings
 * Classes for saving and retrieving application-, project-, and iModel- specific [Settings]($docs/learning/frontend/Settings.md)
 */
/**
 * @docs-group-description OtherServices
 * Classes for communicating with various other services.
 */
/**
 * @docs-group-description Utils
 * Utilities for implementing clients.
 */
