# Managing the ClientRequestContext

Asynchronous backend methods must cooperate to propagate a request's [ActivityId](../../learning/RpcInterface.md#logging-and-activityids) into logging messages. The current ActivityId is held by [ClientRequestContext.current]($bentley). Asynchronous methods must follow several rules to maintain this context.

## Promise-returning functions

Every `Promise`-returning functions *must*:

- Take an argument of type [ClientRequestContext]($bentley).
- Pass the input ClientRequestContext object to each Promise-returning method that it calls.
- Call the [ClientRequestContext.enter]($bentley) method on the input ClientRequestContext object:
  - On its first line.
  - Immediately following each call to `await`.
  - Immediately upon catching an Error thrown by a rejected `await`.
  - On the first line of a `.then` or a `.catch` callback that is invoked by a Promise.

A Promise-returning function must *not* call ClientRequestContext.current.

Note that a Promise-returning method is any method that returns a Promise, whether or not it is declared with the `async` keyword.

*Example*:

``` ts
[[include:ClientRequestContext.asyncMethod]]
```

## RpcInterface implementation methods

There is one exception to the above rule for Promise-returning functions. An [RpcInterface implementation method](../RpcInterface.md#server-implementation) does not take a ClientRequestContext object as an argument. Instead, it must obtain the ClientRequestContext by calling [ClientRequestContext.current]($bentley). An RcpInterface implementation method must follow all of the other rules listed above.

## Callbacks to asynchronous functions

Examples of asynchronous functions that invoke callbacks are:

- setTimeout and setInterval
- XmlHttpRequest (if called in the backend)
- fs async functions (called only in non-portable backend code)

If a callback does any logging or calls functions that do:

- Before invoking an asynchronous function, an app must ensure that the correct ClientRequestContext is assigned to a local variable in the scope that encloses the callback.
- The callback must, on its first line, call the ClientRequestContext.enter method on that local variable in the enclosing scope.

There are two possible cases:

### 1. Asynchronous function invokes an asynchronous function, passing it a callback

In this case, the calling function will take the ClientRequestContext as an argument. The callback must use that object.

*Example*:

``` ts
[[include:ClientRequestContext.asyncCallback]]
```

### 2. Synchronous function invokes an asynchronous function, passing it a callback

In this case, the calling function must save a reference to the ClientRequestContext.current property and transmit that to the callback.

*Example*:

``` ts
[[include:ClientRequestContext.asyncCallback2]]
```

A callback to an async function must never call ClientRequestContext.current.
