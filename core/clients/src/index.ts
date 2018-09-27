/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
export * from "./ECJsonTypeMap";
export * from "./Client";
export * from "./Token";
export * from "./UserProfile";
export * from "./ConnectClients";
export * from "./WsgClient";
export * from "./FileHandler";
export * from "./imodelhub";
export * from "./IModelAccessContext";
export * from "./IModelClient";
export * from "./imodelhub/Client";
export * from "./ImsClients";
export * from "./Config";
export * from "./Request";
export * from "./TilesGeneratorClient";
export * from "./IModelWebNavigatorClient";
export * from "./RealityDataServicesClient";
export * from "./TileDataAccessClient";
export * from "./SettingsAdmin";
export * from "./SettingsClient";

// NOTE: Do not export UrlFileHandler - "fs" dependency
// NOTE: Do not export IModelBank - UrlFileHandler dependency

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
 * @docs-group-description OtherServices
 * Classes for communicating with various other services.
 */
/**
 * @docs-group-description Utils
 * Utilities for implementing clients.
 */
