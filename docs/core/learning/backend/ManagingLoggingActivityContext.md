# Managing the LoggingActivityContext

Asynchronous backend methods must cooperate to propagate a request's [ActivityId](../../overview/RpcInterface.md#logging-and-activityids) into logging messages. The current ActivityId is held by the [LoggingActivityContext]($common) class. The following rules must be followed by async methods to manage this class:

## Promise-returning functions
Every `Promise`-returning method *must*:
* Take an argument of type [LoggingActivityContext]($common).
* Pass the input LoggingActivityContext object to each Promise-returning method that it calls.
* Call the [LoggingActivityContext.enter]($common) method on the input LoggingActivityContext object:
  * On its first line.
  * Immediately following each call to `await`.
  * Immediately upon catching an Error thrown by a rejected `await`.
  * On the first line of a `.then` or a `.catch` callback that is invoked by a Promise.

Note that a Promise-returning method is any method that returns a Promise, whether or not it is declared with the `async` keyword.

There is one exception to the above rule. An [RpcInterface implementation method](../RpcInterface.md#server-implementation) does not take a LoggingActivityContext object as an argument. Instead, it must obtain the LoggingActivityContext by calling [RpcInvocation.current.context]($common). An RcpInterface implementation method must follow all of the other the rules listed above.

## Callbacks to asynchronous functions
Examples of asynchronous functions that invoke callbacks are:
  * `setTimeout` and `setInterval`
  * `XmlHttpRequest` (if called in the backend)
  * `fs` async functions (called only in non-portable backend code)

If a callback passed to an asynchronous function does any logging or calls functions that do, it *must*:
  * Take an argument of type [LoggingActivityContext]($common).
  * Call the [LoggingActivityContext.enter]($common) method on the input LoggingActivityContext object on its first line.
