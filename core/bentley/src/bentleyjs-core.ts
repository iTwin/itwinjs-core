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
 * For more information on iModels, see [Executing ECSQL]($docs/learning/ECSQL.md)
 */
/**
 * @docs-group-description Errors
 * Classes for working with errors. The key classes are:
 * * [BentleyError]($bentleyjs-core.BentleyError)
 * * [IModelStatus]($bentleyjs-core.IModelStatus)
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
 * how or if the logged information is displayed or collected. Logging information is primarily used to diagnose problems after the fact.
 * Logging may also be used to monitor on overally application health.
 *
 * Packages and apps use the [Logger]($bentleyjs-core.Logger) and [LogLevel]($bentleyjs-core.LogLevel) classes to report logging messages. [BentleyError]($bentleyjs-core.BentleyError) is also integrated with logging.
 *
 * Apps can configure logging at run time to filter out unwanted logging messages, in order to produce only the information that is needed.
 * [Logger.setLevel]($bentleyjs-core.Logger.setLevel) and [Logger.configureLevels]($bentleyjs-core.Logger.configureLevels) are used for this configuration.
 * Apps also direct logging output to desired outlets, such as files and log servers.
 * [Logger.initialize]($bentleyjs-core.Logger.initialize), [BunyanLoggerConfig]($bentleyjs-core.BunyanLoggerConfig), and [SeqLoggerConfig]($bentleyjs-core.SeqLoggerConfig) are used to direct logging output.
 *
 * Logging is typically used by services and agents, which have no user interface. Logging allows the service operations
 * to be monitored from outside of the process. A service typically initializes and configures logging in its startup logic.
 *
 * Configuration can be based on the configuration parameters of the service, which may be set by the deployment mechanism.
 * <p><em>Example:</em>
 * ``` ts
 * [[include:Logging.serviceLoggingExample]]
 * ```
 * An example of the logging portion of a configuration .json file that is deployed with a service might be:
 * ``` json
 * {
 *   "loggerConfig": {
 *      "defaultLevel": "${ROBOT-WORLD-DEFAULT-LOG-LEVEL}",
 *      "categoryLevels": [
 *          {"category": "ROBOT-WORLD", "logLevel": "Trace"},
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
 *      "hostURL": "${ROBOT-WORLD-SEQ-URL}",
 *      "port": "${ROBOT-WORLD-SEQ-PORT}"
 *    }
 * }
 * ```
 */
/**
 * @docs-group-description Utils
 * Miscellaneous utility classes.
 */
