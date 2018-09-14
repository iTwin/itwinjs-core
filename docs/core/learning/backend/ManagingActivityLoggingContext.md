# Managing the ActivityLoggingContext

Asynchronous backend methods must cooperate to propagate a request's [ActivityId](../../overview/RpcInterface.md#logging-and-activityids) into logging messages. The current ActivityId is held by the [ActivityLoggingContext]($bentleyjs-core) class. The following rules must be followed by async methods to manage this class:

## Promise-returning functions
Every `Promise`-returning method *must*:
* Take an argument of type [ActivityLoggingContext]($bentleyjs-core).
* Pass the input ActivityLoggingContext object to each Promise-returning method that it calls.
* Call the [ActivityLoggingContext.enter]($bentleyjs-core) method on the input ActivityLoggingContext object:
  * On its first line.
  * Immediately following each call to `await`.
  * Immediately upon catching an Error thrown by a rejected `await`.
  * On the first line of a `.then` or a `.catch` callback that is invoked by a Promise.

Note that a Promise-returning method is any method that returns a Promise, whether or not it is declared with the `async` keyword.

There is one exception to the above rule. An [RpcInterface implementation method](../RpcInterface.md#server-implementation) does not take a ActivityLoggingContext object as an argument. Instead, it must obtain the ActivityLoggingContext by calling [ActivityLoggingContext.current]($bentleyjs-core). An RcpInterface implementation method must follow all of the other the rules listed above.

## Callbacks to asynchronous functions
Examples of asynchronous functions that invoke callbacks are:
  * `setTimeout` and `setInterval`
  * `XmlHttpRequest` (if called in the backend)
  * `fs` async functions (called only in non-portable backend code)

If a callback does any logging or calls functions that do:
  * *Before* invoking the function that emits events, an app must assign the current ActivityLoggingContext to a local variable.
  * The callback that the app passes to that function must, on its first line, call the [ActivityLoggingContext.enter]($bentleyjs-core) method on that local variable in the enclosing scope.
