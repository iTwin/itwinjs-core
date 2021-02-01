# Implementing Ipc Interfaces

This article discusses IPC communication in iModel.js. See also [RPC vs IPC](./RpcVsIpc.md).

## Overview

[IPC](https://en.wikipedia.org/wiki/Inter-process_communication) (Inter-Process Communication)) is a direct-connect communication technique used in iModel.js when the frontend and backend processes are paired one-to-one. IPC is most commonly used for [native apps](./NativeApps.md) where both processes are always on the same computer, but may also be used by web apps with a "dedicated" backend.

## IpcSocket Interface

The basis for communication between the frontend/backend pair is a platform-specific implementation of the [IpcSocket]($common) interface. There are two specializations of IpcSocket, [IpcSocketFrontend]($common) and [IpcSocketBackend]($common) for the frontend and backend respectively. They both allow sending and receiving messages, but frontend has a method to invoke _functions_ on the backend, and the backend interface has a method to handle those invocations.

For desktops, those interfaces are implemented by Electron's ipc layers, exposed through the `@bentley/electron-manager` package.

To use Ipc under Electron, you must initialize both the backend and the backend:

```ts
[[include:RpcInterface.initializeBackendForElectron]]

```

and

```ts
[[include:RpcInterface.initializeFrontendForElectron]]

```

For mobile devices those interfaces are implemented over WebSockets.

TODO: mobile initialization

## FrontendIpc and BackendIpc

Generally, iModel.js programmers won't need to work with the low-level `IpcSocket` interface.

On the frontend, the class [FrontendIpc]($common) must be initialized at startup with the platform-specific implementation of `IpcSocketFrontend` and contains the method [FrontendIpc.addListener]($common) to supply a handler for notification messages sent from the backend to the frontend.

On the backend, the class [BackendIpc]($common) must be initialized at startup with the platform-specific implementation of `IpcSocketBackend` and contains the method [BackendIpc.send]($common) to send a notification message from the backend to the frontend.

Since Ipc is only enabled in situations where a dedicated backend is available, each of `FrontendIpc` and `BackendIpc` have an `isValid` method that may be tested from code designed to work with or without Ipc.

## Creating Your own Ipc Interfaces and IpcHandlers

To enable type-safe cross-process method calls using IPC, there are three required pieces:

1. Define the method signatures in an interface. This must be in a file that can be `import`ed from both your frontend code and backend code. In iModel.js we use the convention of a folder named `common` for this purpose. Note that all methods in your interface must return a `Promise`. In the same file, define a variable that has a string with a unique name for the _ipc channel_ your interface will use. If you'd like, you can incorporate a version identifier in the channel name (e.g. append "-1").

```ts
const myChannel = "my-interface-1";

interface MyInterface {
  sayHello(arg1: string, arg2: number, arg3: boolean): Promise<string>;
}
```

2. In your backend code, implement a class that extends [IpcHandler]($common) and implements the interface you defined in step 1. In your startup code, call the static method `register` on your new class. Your class must implement the abstract method `get channelName()`. Return the channel name variable from your interface file.

```ts
class MyClass extends IpcHandler implements MyInterface
  public get channelName() { return myChannel; }
  public async sayHello(arg1: string, arg2: number, arg3: boolean) {
    return `hello: ${arg1} ${arg2} ${arg3}`
  }

  // ...in startup code
  MyClass.register();
```

3. In your frontend code, implement a function like:

```ts
  import { AsyncMethodsOf, PromiseReturnType } from "@bentley/imodeljs-common";

  const callMyBackend = async <T extends AsyncMethodsOf<MyInterface>>(methodName: T,...args: Parameters<MyInterface[T]>) => {
    return FrontendIpc.callBackend(myChannel, methodName, ...args) as PromiseReturnType<MyInterface[T]>;
  };
```

The TypeScript gobbledygook in Step 3 above creates a type-safe asynchronous function you can use to invoke methods on your backend class from your frontend code.

```ts
const method1Val = await callMyBackend("sayHello", "abc", 10, true);
```

> Note that all IPC methods return a `Promise`, so their return value must be `await`ed.

As you refine your interface, you may decide to change your channel name.

Your application can have as many Ipc Interfaces as you like (each must have a unique channel name), and each of your interfaces may have as many functions as you need.
