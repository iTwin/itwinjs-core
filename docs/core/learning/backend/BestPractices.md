# Best Practices for Writing Backend Code and Designing RpcInterfaces

When writing a backend, you are effectively writing a server. A server has several unique requirements. It has no UI of its own, and so logging must be used to diagnose problems and to monitor health. A server may have many clients, and so it must not spend too much time on any single request. A server may return its results over the Internet, and so bandwidth must be considered. Here are some tips for writing a backend that meets these requirements.

Many of these requirements affect the design of [RpcInterfaces](../RpcInterface.md).

While the focus of this article is on backend and RpcInterface design, in many cases frontend/client design is the other side of the same coin. The [last section](#rpcinterfaces-and-frontend-design)  describes some implications for frontends of backend design best practices where applicable.

## Diagnostics

Log all Errors that you throw. Be sure to define the logging-related arguments to the [IModelError]($bentleyjs/IModelError) constructor.

Maintain the ActivityLoggingContext so that logging emitted by backend and common code is correlated with frontend requests. See [the learning article](./ManageActivityLoggingContext.md).

## Do not Block Too Long

Use async functions when an operation is inherently asynchronous. Example: requesting a resource from the Internet or reading a huge image file from disk.

Break up a long-running synchronous operation into small increments, yielding back to the libuv event loop at regular intervals. You might say that your server must "come up for air" often to remain responsive. The operation becomes a series of asynchronous operations.

Here is some pseudo-code to illustrate yielding. The code assumes that you have
``` ts
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async someServerFunction(many items): Promise<boolean> {
   while (processing many items) {
      if (time elapsed > 100 ms)
        await pause(0);
   }
   return Promise.resolve(true);
}
```

Note how the yield calls `setTimeout`. That is what causes the backend to return to the libuv event loop.

At the same time, the units of work performed by backend code must be "right-sized", not too large or too small. This requirement is addressed mostly in RpcInterface and frontend design, [as described below](#rpcinterfaces-and-frontend-design).

## Operation Interleaving

Backend code must be prepared for a series of asynchronous operations to be interleaved with other operations. For example, while running the processing loop above, the backend may receive and begin to process a new request. The backend must set mode flags or acquire locks as needed in order to prevent interleaved operations from interfering with each other.

Be prepared for redundant requests. After one client requests a long-running operation, another client (or the same client) might request the same operation, while the first is still in progress. Memoizing a Promise is a good way to handle redundant requests. That way, all redundant calls get back the same Promise, which is resolved once for all when the operation finishes.

## RpcInterfaces and Frontend Design

### Right-sized requests
RpcInterfaces must be "phrased" so that clients can make right-sized requests. RpcInterfaces must be "chunky" and not "chatty". One good strategy to avoid chatty interfaces is to [write a backend that is tailored to the needs of the frontend](../AppTailoring.md#backends-for-frontends).

### Paged Queries
Clients must page all queries. A client must not issue a query that produces a very large result. Instead, a client must break up a large query into a series of requests, so that results are returned in small increments. The ECSql limit/offset query parameters are used for this purpose.

### Event-Driven Design
As explained in [the app architecture overview](../App.md#interactive-apps), frontend and backend never run in the same JavaScript context. Requests are always asynchronous, and it is impossible to predict how long even a right-sized request will take. Therefore, frontend/client code cannot simply demand a result from a backend and then freeze while waiting for it. Instead, frontend code must be designed like a state machine and must be event-driven. For example, the frontend must go into a mode where only part of its UI is available while some long-running backend operation such as opening a briefcase or importing a schema is in progress. Query-paging is another example of the need for a frontend to maintain state data.

### Refreshing
Frontends and clients must also be ready for backends to become temporarily or permanently unavailable and for AccessTokens to need refreshing.
