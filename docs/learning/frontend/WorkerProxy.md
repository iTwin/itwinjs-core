# Type-safe Workers using WorkerProxy

By default, all of your JavaScript code executes on a single thread - the same thread that is also responsible for handling user interaction and rendering the document. If your code takes too long to execute, it can introduce a degraded or even unusable user experience by blocking the main thread. But some tasks are intrinsically more complicated, requiring a long or simply indeterminate amount of time to complete.

JavaScript provides [Worker](https://developer.mozilla.org/en-US/docs/Web/API/Worker)s as a solution to this problem, enabling chunks of code to execute on a background thread, often receiving input from and returning output to the main thread. The `postMessage` and `onmessage` methods of `Window` and `Worker` orchestrate this communication. However, these are low-level APIs that require you to manage the following concerns:
- Defining the set of operations that the Worker provides.
- Ensuring that the two threads agree on the types of the inputs and outputs of each operation.
- Propagating errors between threads.
- Associating each outgoing message with the corresponding incoming response.
- Leveraging [transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects) to avoid unnecessary, expensive copying of data between threads.

[WorkerProxy]($frontend) provides a type-safe wrapper around a Worker that permits you to define an interface describing your Worker's operations and create a proxy object to invoke those operations on your Worker and receive the results.

## Example: Calculator

To illustrate the basics of `WorkerProxy`, let's use a contrived example of a "calculator". Here's the interface describing the operations the calculator provides:

```ts
[[include:Worker_CalculatorInterface]]
```

Note that it defines synchronous functions that accept 0, 1, or 2 arguments and returning a single value.

Next, let's write the script that will implement the `Calculator` interface, to be run on a Worker:

```ts
[[include:Worker_CalculatorImplementation]]
```

Note that the function signatures of `pi`, which takes zero arguments, and `squareRoot`, which takes one argument, are identical to those in the `Calculator` interface. But the signatures for `add` and `divideAll`, which each take two arguments, have changed to accept the arguments as a tuple containing two values. The type of each element of the tuple matches the type of the corresponding argument in the `Calculator` method. You'll see why momentarily, but the rule is that for any function in the interface accepting two or more parameters, the parameters are converted to a single tuple containing the same number and types of elements as defined by the parameter list.

Further, note that while `Calculator.divideAll` is defined to return a `number`, our implementation returns `{ result: number, transfer: Transferable[] }`. This permits the implementation to specify that the `ArrayBuffer` backing the `Float64Array` should be cheaply transferred back to the main thread, instead of making a potentially expensive copy. Any function declared by the worker's interface as returning a type `T` may opt to instead return `{ result: T, transfer: Transferable[] }` in the same manner.

From the main thread, we can instantiate a `WorkerProxy` based on our `Calculator` interface by invoking [createWorkerProxy]($frontend), supplying the absolute or relative URL of the script containing our call to [registerWorker]($frontend):

```ts
[[include:Worker_CreateCalculatorProxy]]
```

We can then invoke the operations of the calculator:

```ts
[[include:Worker_UseCalculator]]
```

Note that we must `await` the result of each operation, because we are communicating asynchronously with a Worker running on a different thread. Also note that when we invoke `add`, which takes two arguments, we must provide the arguments as a tuple: `[2, 3]`. This is because the `WorkerProxy` alters the `Calculator` interface to look like this:

```ts
[[include:Worker_CalculatorProxy]]
```

Again, each method of `Calculator` taking more than one argument is transformed into a method taking those same arguments as a single tuple. Each method also becomes `async`, returning a `Promise`. And each method gains an additional, optional argument - an array of objects to be transferred from the main thread to the Worker.

In the case of `divideAll`, we want to pass a Float64Array to the Worker, which will modify it and return it back to us. By default, that would involve copying the entire array twice, which could be expensive if the array is relatively large. Instead, we can make use of the `transfer` argument to avoid making any copies:

```ts
[[include:Worker_CalculatorTransfer]]
```

We can continue invoking operations on the Worker for as long as we need it. When we're finished with it, we can terminate it:

```ts
[[include:Worker_TerminateCalculatorProxy]]
```

## Example: Creating graphics

Graphics creation represents a more realistic use case for Workers than the contrived calculated example above. [GraphicBuilder]($frontend) is fine for creating simple [RenderGraphic]($frontend)s like decorations on the main thread. But imagine you are streaming large data sets like point clouds, GeoJSON, or Shapefiles which you must process into complex graphics - attempting to do so on the main thread would utterly degrade the responsiveness of the application.

[GraphicDescriptionBuilder]($frontend) provides almost exactly the same API as [GraphicBuilder]($frontend), except that it can be used on a Worker. Instead of a [RenderGraphic]($frontend), it produces a [GraphicDescription]($frontend) that can be efficiently converted into a `RenderGraphic` on the main thread.

The `GraphicCreator` interface and related types below illustrate the concept using a simple method that creates a `GraphicDescription` from a description of any number of circles with location, radius, and color attributes:

```ts
[[include:Worker_GraphicCreatorInterface]]
```

We can implement the `createCircles` method in a worker script as follows:
```ts
[[include:Worker_GraphicCreatorRegister]]
```

Then we can define a `createCircleGraphic` function that can be called from the main thread to create a `RenderGraphic`, leveraging the Worker defined above to move most of the processing to a background thread:

```ts
[[include:Worker_GraphicCreatorInvoke]]
```
