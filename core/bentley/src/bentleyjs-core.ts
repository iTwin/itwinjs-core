/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
export * from "./Assert";
export * from "./BeEvent";
export * from "./BentleyError";
export * from "./BeSQLite";
export * from "./Disposable";
export * from "./Id";
export * from "./JsonUtils";
export * from "./Logger";
export * from "./LRUMap";
export * from "./Time";

/** @module Utils */

/** @docs-package-description
 * The bentleyjs-core package contains classes for designed to solve common problems that are
 * needed by many different kinds of apps, both client and server.
 */
/**
 * @docs-group-description BeSQLite
 * Classes and enums for working with the SQLite database that underlies IModelDb and ECDb.
 * For more information on iModels: [[?]]
 */
/**
 * @docs-group-description Errors
 * Classes for working with errors. The key classes are:
 * * #BentleyError
 * * #IModelStatus
 */
/**
 * @docs-group-description Events
 * Classes for raising and handling events.
 */
/**
 * @docs-group-description Ids
 * Classes for working with unique identifiers.
 */
/**
 * @docs-group-description Logging
 * Logging allows packages and apps to report potentially useful information about operations, and it allows apps and users to control
 * how or if the logged information is displayed or collected. Apps can configure logging at run time to filter out unwanted logging messages,
 * in order to produce only the information that is needed. Apps also direct logging output to desired outlets, such as files and log servers.
 *
 * Logging is typically used by services, agents, and app backends, where there is no user interface. Logging allows the backend operations
 * to be monitored from outside of the process.
 *
 * A backend typically initializes and configures logging in its startup logic.
 *
 * Configuration can be based on the configuration parameters of the backend, which may be set by the deployment mechanism.
 * <p><em>Example:</em>
 * ``` ts
 * [[include:Logging.serviceLoggingExample]]
 * ```
 * An example of the logging portion of a configuration a .json file that is deployed with a service might be:
 * ``` json
 * {
 *   "loggerConfig": {
 *      "defaultLevel": "${MY-SERVICE-DEFAULT-LOG-LEVEL}",
 *      "categoryLevels": [
 *          {"category": "MyService", "logLevel": "Trace"},
 *          {"category": "imodeljs-gateway.BentleyCloudGatewayProtocol", "logLevel": "Trace"},
 *          {"category": "imodeljs-gateway.GatewayHttpProtocol", "logLevel": "Trace"},
 *          {"category": "imodeljs-gateway", "logLevel": "Trace"},
 *          {"category": "imodeljs-backend.AutoPush", "logLevel": "Trace"},
 *          {"category": "ECPresentation", "logLevel": "None"},
 *          {"category": "Diagnostics.ECSqlStatement", "logLevel": "None"},
 *          {"category": "ECObjectsNative", "logLevel": "None"},
 *          {"category": "UnitsNative", "logLevel": "None"},
 *          {"category": "BeSQLite", "logLevel": "None"}
 *      ]
 *    },
 *    "seq": {
 *      "hostURL": "${MY-SERVICE-SEQ-URL}",
 *      "port": "${MY-SERVICE-SEQ-PORT}"
 *    },
 * }
 * ```
 */
/**
 * @docs-group-description Utils
 * Miscellaneous utility classes.
 */
