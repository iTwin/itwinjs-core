# Implementing IpcInterfaces

This article discusses IPC communication in iModel.js. See also [RPC vs IPC](./RpcVsIpc.md).

Table of Contents:

## Overview

[IPC](https://en.wikipedia.org/wiki/Inter-process_communication) (Inter-Process Communication)) is a direct-connect communication technique used in iModel.js when the frontend and backend processes are paired one-to-one. IPC is most commonly used for [native apps](./NativeApps.md) where both processes are always on the same computer, but may also be used by web apps with a "dedicated" backend.

## IpcSocket Interface

The basis for communication between the frontend/backend pair is a platform-specific implementation of the [IpcSocket]($common) interface. There are two specializations of IpcSocket, [IpcSocketFrontend]($common) and [IpcSocketBackend]($common) for the frontend and backend respectively. They both allow sending and receiving messages, but frontend has a method to invoke *functions* on the backend, and the backend interface has a method to handle those invocations.

For desktops, those interface is implemented by Electron's ipc layers, exposed through the `@bentley/electron-manager` package. For mobile devices those interfaces are implemented over WebSockets.

TODO: add startup code example

## FrontendIpc and BackendIpc

Generally, iModel.js programmers won't need to work with the low-level `IpcSocket` interface.

On the frontend, the class [FrontendIpc]($frontend) must be initialized at startup with the platform-specific implementation of `IpcSocketFrontend` and contains the method [FrontendIpc.handleMessage]($frontend) to supply a handler for notification messages sent from the backend to the frontend.

On the backend, the class [BackendIpc]($backend) must be initialized at startup with the platform-specific implementation of `IpcSocketBackend` and contains the method [BackendIpc.sendMessage]($backend) to send a notification message from the backend to the frontend.

Since Ipc is only enabled in situations where a dedicated backend is available, each of `FrontendIpc` and `BackendIpc` have an `isValid` method that may be tested from code designed to work with or without Ipc.

## Creating Your own IpcInterface and IpcHandlers

To enable type-safe cross-process method calls using IPC, there are three required pieces:

1. Define the method signatures in an interface that extends [IpcInterface]($common). This must be in a file that can be `import`ed from both your frontend code and backend code. In iModel.js we use the convention of a folder named `common` for this purpose. Note that all methods in your interface must return a `Promise`. In the same file, define a variable that has a string with a unique name for the *ipc channel* your interface will use. Also, define a variable with a string for a version identifier.

1. In your backend code, implement a class that extends [IpcHandler]($backend) and implements the interface you defined in step 1. In your startup code, call the static method `register` on your new class. Your class must implement the abstract methods `get channelName()` and `getVersion()`. Return the channel name and version variables from your interface file.

1. In your frontend code, implement a function like:

```ts
  const callMyBackend = <T extends keyof MyInterface>(methodName: T, ...args: Parameters<MyInterface[T]>): ReturnType<MyInterface[T]> {
    return FrontendIpc.callBackend(myChannel, methodName, ...args) as ReturnType<MyInterface[T]>;
  }
```

The TypeScript gobbledygook in Step 3 above creates a type-safe asynchronous function you can use to invoke methods on your backend class from your frontend code.

```ts
  const method1Val = await callMyBackend("method1", arg1, arg2, arg3);
```

> Note that all IPC methods return a `Promise`, so their return value must always be `await`ed.

It is probably a good practice to ensure that your backend is properly matched with your frontend somewhere in your startup code. E.g.:

```ts
    const ipcVersion = await callMyBackend("getVersion");
    if (ipcVersion !== myIpcVersion) {
      throw new IModelError(IModelStatus.BadArg, `myIpcVersion version wrong: backend(${ipcVersion}) vs. frontend(${myIpcVersion})`);
    }
```

As you refine your interface, you should change your version string.

Your application can have as many `IpcInterfaces` as you like (each must have a unique channel name), and each of your interfaces may have as many functions as you need.
