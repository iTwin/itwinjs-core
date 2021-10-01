# Logging

Logging allows libraries and apps to report potentially useful information about operations, and it allows apps and users to control how or if the logged information is displayed or collected. Logging information is primarily used to diagnose problems after the fact. Logging may also be used to monitor application health.

To log a message, call [Logger.logError]($core-bentley), [Logger.logWarning]($core-bentley), [Logger.logInfo]($core-bentley), or [Logger.logTrace]($core-bentley), depending on the level of importance of the message.

[BentleyError]($core-bentley) is integrated with logging.

## LogLevels

Each of the logging output functions assigns a [LogLevel]($core-bentley) to the specified message. LogLevel is like a property of a logging message. The app that produces logging messages can control output by filtering on LogLevel. And the dashboards that consume logging messages can filter and organize logging messages by LogLevels.

[LogLevel]($core-bentley) is a pre-defined enum that is chosen by the app that generates logging messages. The app must choose the appropriate level for each message, so that the purpose of a message is clear and so that the most important messages stand out.

## Categories

Each of the logging output functions takes the *category* of the message as its first argument and associates this string with the specified message. Category is like a property of a logging message. The app that produces logging messages can control output by filtering on category. And the dashboards that consume logging messages can filter and organize logging messages by categories.

Categories are freeform strings that are made up by the app that generates logging messages. A well-chosen category string make messages useful and manageable. In some cases, the category will be used to identify the source of the message. For example, when logging messages from many different services are streamed to a single file or dashboard, users will rely on the category of a message to identify its source. The category will also be used to group messages. For example, all logging messages that pertain to a certain module should have the same category.

Parent/child category naming is often useful for achieving uniqueness and grouping.

### Parent and Child Categories

If a category name has a "." in it, then the part to the left is interpreted as the parent category and the part to the right is the child. If you pass a parent category to [Logger.setLevel]($core-bentley), then the specified level filter will be applied to all children of that level. If you call [Logger.setLevel]($core-bentley) on a specific child category, then the level you specify will apply to that child, while the parent's level will apply to all other children. Children can be nested.

## Controlling the Destination of Logging Messages

The app controls how to handle log messages by supplying to [Logger.initialize]($core-bentley) the functions that handle messages for each log level. These functions are called "streams". See the convenience method [Logger.initializeToConsole]($core-bentley) for a simple way to direct logging output to the console.

## Controlling What is Logged

The app that produces logging output can apply filters at runtime to control which messages are actually sent to the destination.

The simplest way to turn off logging at a particular log level is for the app simply not to supply a stream for that level. Or, the app can supply a stream that does its own internal filtering.

### Filtering messages by level and category

[Logger.setLevel]($core-bentley) and [Logger.configureLevels]($core-bentley) can be used to control logging output by level and category.

There are two filtering strategies.

#### 1. Opt out

In this strategy, you start by turning all categories on at a certain level by default and then setting the levels of specific categories to other levels.

*Example:*

```ts
Logger.initializeToConsole();
Logger.setLevelDefault(LogLevel.Error);
Logger.setLevel("Diagnostics", LogLevel.None);
```

This approach is mainly useful when you are just trying to find out what is happening. For example, to debug a problem when you do not know where to start looking, you might turn all categories "on" by default at some level. This can produce a lot of logging output. After reviewing the output, you might then turn "off" the categories that are not relevant to your search by setting their levels to None. You might also turn "up" the categories that seem to be of interest.

#### 2. Opt in

In this strategy, you leave most categories off by default and then turn on the ones you do want.

*Example:*

```ts
Logger.initializeToConsole();
Logger.setLevel("MyCategory", LogLevel.Info);
```

This approach is useful when you want to monitor the activity in a small number of known modules, where you already know the names of the categories that they use.

## Configuration Files

A service typically initializes and configures logging in its startup logic. Configuration can be based on the configuration parameters of the service, which may be set by the deployment mechanism. The simplest way to do this is to use [LoggerLevelsConfig]($core-bentley). This is normally used in conjunction with a stream config. Both are normally stored in a config file that is deployed with the service.

*Example:*

``` ts
[[include:Logging-configureLoggingAndStreams.example-code]]
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
