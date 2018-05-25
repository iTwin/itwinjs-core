# Logging

Logging allows libraries and apps to report potentially useful information about operations, and it allows apps and users to control how or if the logged information is displayed or collected. Logging information is primarily used to diagnose problems after the fact. Logging may also be used to monitor application health.

To log a message, call [Logger.logError]($bentleyjs-core), [Logger.logWarning]($bentleyjs-core), [Logger.logInfo]($bentleyjs-core), or [Logger.logTrace]($bentleyjs-core), depending on the *level* or importance of the message.

[BentleyError]($bentleyjs-core) is integrated with logging.

## LogLevels
Each logging message is assigned a level of importance. This allows the logging output pipeline to filter on [LogLevel]($bentleyjs-core).

## Categories
Each of the logging methods takes the *category* of the message as its first argument. A category is a freeform tag that is associated with the message as it travels through filters and output streams. The app that produces logging messages can control output by filtering on categories. And the dashboards that consume logging messages can filter and organize logging messages by categories.

Categories are freeform strings that are assigned by the app that generates logging messages. It is important to use descriptive and unique categories. In many cases, logging messages from a service will go to a file or service that aggregates logging output from many services.

### Parent and Child Categories
If a category name has a "." in it, then the part to the left is interpreted as the parent category and the part to the right is the child. If you pass a parent category to [Logger.setLevel]($bentleyjs-core), then the specified level filter will be applied to all children of that level. If you call [Logger.setLevel]($bentleyjs-core) on a specific child category, then the level you specify will apply to that child, while the parent's level will apply to all other children. Children can be nested.

## Controlling the Destination of Logging Messages
The app controls how to handle log messages by supplying to [Logger.initialize]($bentleyjs-core) the functions that handle messages for each log level. These functions are called "streams". See the convenience method [Logger.initializeToConsole]($bentleyjs-core) for a simple way to direct logging output to the console.
See [BunyanLoggerConfig]($bentleyjs-core) for an example of how to direct logging to the Bunyan logging system.
See [SeqLoggerConfig]($bentleyjs-core) for an example of how to direct logging to the seq logging server.

## Controlling What is Logged
The app that produces logging output can apply filters at runtime to control which messages are actually sent on to the destination.

The simplest way to turn off logging at some log level is for the app simply not to supply a stream for that level.
Or, the app can supply a stream that does its own internal filtering.

### Filtering messages by level and category
Finally, [Logger.setLevel]($bentleyjs-core) and [Logger.configureLevels]($bentleyjs-core) can be used to control logging output by level and category.

There are two filtering strategies.

#### 1. Opt out.
In this strategy, you start by turning all categories on by default and then turn off the ones you don't want.
```
Logger.initializeToConsole();
Logger.setLevelDefault(LogLevel.Error);
Logger.setLevel("Diagnostics", LogLevel.None);
```
This approach is mainly useful when you are just trying to find out what is happening, for example, to debug a problem when you don't have much data.
This can produce a lot of logging output.

#### 2. Opt in
In this strategy, you leave most categories off by default and then turn on the ones you do want.
```
Logger.initializeToConsole();
Logger.setLevel("MyCategory", LogLevel.Info);
```
This approach is useful when you want to monitor the activity in a small number of known modules, where you already know the names of the categories that they use.

## Configuration Files
A service typically initializes and configures logging in its startup logic. Configuration can be based on the configuration parameters of the service, which may be set by the deployment mechanism.

*Example:*
``` ts
[include:Logging.serviceLoggingExample]
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