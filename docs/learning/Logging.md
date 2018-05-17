# Logging

Logging allows libraries and apps to report potentially useful information about operations, and it allows apps and users to control how or if the logged information is displayed or collected. Logging information is primarily used to diagnose problems after the fact. Logging may also be used to monitor application health.

Libraries and apps use the [Logger]($bentleyjs-core) and [LogLevel]($bentleyjs-core) classes to report logging messages. [BentleyError]($bentleyjs-core) is also integrated with logging.

Apps can configure logging at run time to filter out unwanted logging messages, in order to produce only the information that is needed. [Logger.setLevel]($bentleyjs-core) and [Logger.configureLevels]($bentleyjs-core) are used for this configuration. Apps also direct logging output to desired outlets, such as files and log servers. [Logger.initialize]($bentleyjs-core), [BunyanLoggerConfig]($bentleyjs-core), and [SeqLoggerConfig]($bentleyjs-core) are used to direct logging output.

Logging is typically used by services and agents, which have no user interface. Logging allows the service operations
to be monitored from outside of the process. A service typically initializes and configures logging in its startup logic.

Configuration can be based on the configuration parameters of the service, which may be set by the deployment mechanism.
*Example:*
``` ts
[[include:Logging.serviceLoggingExample]]
```
An example of the logging-related sections of a configuration .json file that is deployed with a service might be:
``` json
{
  "loggerConfig": {
     "defaultLevel": "${ROBOT-WORLD-DEFAULT-LOG-LEVEL}",
     "categoryLevels": [
         {"category": "ROBOT-WORLD", "logLevel": "Trace"},
         {"category": "imodeljs-rpc", "logLevel": "Trace"},
         {"category": "imodeljs-backend.AutoPush", "logLevel": "Trace"},
         {"category": "ECPresentation", "logLevel": "None"},
         {"category": "Diagnostics.ECSqlStatement", "logLevel": "None"},
         {"category": "ECObjectsNative", "logLevel": "None"},
         {"category": "UnitsNative", "logLevel": "None"},
         {"category": "BeSQLite", "logLevel": "None"}
     ]
   },
   "seq": {
     "hostURL": "${ROBOT-WORLD-SEQ-URL}",
     "port": "${ROBOT-WORLD-SEQ-PORT}"
   }
}
```