# Managing the ActivityLoggingContext

Asynchronous backend methods must cooperate to propagate a request's [ActivityId](../../learning/RpcInterface.md#logging-and-activityids) into logging messages. The current ActivityId is held by [ActivityLoggingContext.current]($bentleyjs-core). Asynchronous methods must follow several rules to maintain this context.

## Promise-returning functions
Every `Promise`-returning functions *must*:
* Take an argument of type [ActivityLoggingContext]($bentleyjs-core).
* Pass the input ActivityLoggingContext object to each Promise-returning method that it calls.
* Call the [ActivityLoggingContext.enter]($bentleyjs-core) method on the input ActivityLoggingContext object:
  * On its first line.
  * Immediately following each call to `await`.
  * Immediately upon catching an Error thrown by a rejected `await`.
  * On the first line of a `.then` or a `.catch` callback that is invoked by a Promise.

A Promise-returning function must *not* call ActivityLoggingContext.current.

Note that a Promise-returning method is any method that returns a Promise, whether or not it is declared with the `async` keyword.


*Example*:
``` ts
[[include:ActivityLoggingContext.asyncMethod]]
```

## RpcInterface implementation methods

There is one exception to the above rule for Promise-returning functions. An [RpcInterface implementation method](../RpcInterface.md#server-implementation) does not take a ActivityLoggingContext object as an argument. Instead, it must obtain the ActivityLoggingContext by calling [ActivityLoggingContext.current]($bentleyjs-core). An RcpInterface implementation method must follow all of the other rules listed above.

## Callbacks to asynchronous functions
Examples of asynchronous functions that invoke callbacks are:
  * setTimeout and setInterval
  * XmlHttpRequest (if called in the backend)
  * fs async functions (called only in non-portable backend code)

If a callback does any logging or calls functions that do:
  * Before invoking an asynchrounous function, an app must ensure that the correct ActivityLoggingContext is assigned to a local variable in the scope that encloses the callback.
  * The callback must, on its first line, call the ActivityLoggingContext.enter method on that local variable in the enclosing scope.

There are two possible cases:
### 1. Asynchronous function invokes an asynchronous function, passing it a callback.

In this case, the calling function will take the ActivityLoggingContext as an argument. The callback must use that object.

*Example*:
``` ts
[[include:ActivityLoggingContext.asyncCallback]]
```

### 2. Synchronous function invokes an asynchronous function, passing it a callback.

In this case, the calling function must save a reference to the ActivityLoggingContext.current property and transmit that to the callback.

*Example*:
``` ts
[[include:ActivityLoggingContext.asyncCallback2]]
```


A callback to an async function must never call ActivityLoggingContext.current.