# Managing the LoggingActivityContext

Backend methods must cooperate to propagate a request's [ActivityId](../../overview/RpcInterface.md#logging-and-activityids) into logging messages. The current ActivityId is held by the [LoggingActivityContext]($common) class. The following rules must be followed in order to manage the state of this context:

Every Promise-returning method:
* Must take an argument of type ManagingLoggingActivityContext.md.
* Must pass its input LoggingActivityContext object to each Promise-returning method that it calls.
* Must call the [LoggingActivityContext.enter]($common) method on its input context object:
  * On its first line.
  * Immediately following each call to `await`.

Note that a Promise-returning method is any method that returns a Promise, whether or not it is marked as `async`.

There is one exception to the above rule. An [RpcInterface implementation method](../RpcInterface.md#server-implementation) does not take a LoggingActivityContext object as an argument. Instead, it must obtain the LoggingActivityContext by calling [RpcInvocation.current.context]($common). Otherwise, as a Promise-returning function, an RcpInterface implementation method must follow the rules listed above.