/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IpcSocket
 */

/**
 * The prefix for all IpcSocket channels to disambiguate from system channels.
 * @internal
 * */
export const iTwinChannel = (channel: string) => `itwin.${channel}`;

/**
 * A function to handle an Ipc message.
 * @onternal
 */
export type IpcListener = (evt: any, ...arg: any[]) => void;

/**
 * Function returned when establishing an Ipc `receive` listener or `invoke` handler. Call this method to remove the listener/handler.
 * @alpha
 */
export type RemoveFunction = () => void;

/**
 * Payload of an IpcInvoke response. The presence of `error` indicates that the backend threw an exception and the
 * frontend will re-throw a [BackendError]$(frontend) with the `errorNumber` and `message` values. Otherwise the `result`
 * member holds the response.
 * @internal */
export type IpcInvokeReturn = { result: any, error?: never } | { result?: never, error: { name: string, message: string, errorNumber: number } };

/**
 * An inter-process socket connection between a single [IModelHost]($backend) on the backend (the node process), and an [IModelApp]($frontend) on
 * the frontend (the browser process.) Each side will implement this interface to form a two way connection. The frontend and backend
 * processes connected through an IpcSocket don't necessarily have to be on the same computer, but often are.
 * @internal
*/
export interface IpcSocket {
  /**
   * Send a message over the socket.
   * @param channel The name of the channel for the message. Must begin with the [[iTwinChannel]] prefix.
   * @param data The optional data of the message.
   */
  send: (channel: string, ...data: any[]) => void;
  /**
   * Establish a handler to receive messages for a channel through a socket.
   * @param channel The name of the channel for the messages. Must begin with the [[iTwinChannel]] prefix.
   * @param listener A function called when messages are sent over `channel`
   * @returns A function to call to remove the listener.
   */
  receive: (channel: string, listener: IpcListener) => RemoveFunction;
}

/**
 * Interface for the frontend (browser) side of a socket connection. Frontends may invoke methods implemented on the backend.
 * @intenal
 */
export interface IpcSocketFrontend extends IpcSocket {
  /**
   * Send a message to the backend via `channel` and expect a result asynchronously.
   * @param channel The name of the channel for the method.  Must begin with the [[iTwinChannel]] prefix.
   * @see Electron [ipcRenderer.invoke](https://www.electronjs.org/docs/api/ipc-renderer) documentation for details.
   * Note that this interface *may* be implemented via Electron for desktop apps, or via
   * [WebSockets](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API) for mobile or web-based
   * Ipc connections. In either case, the Electron documentation provides the specifications for how it works.
   */
  invoke: (channel: string, methodName: string, ...args: any[]) => Promise<any>;
};

/**
 * Interface for the backend (node) side of a socket connection. Backends provide the implementation
 * of methods that are invoked from the frontend.
 * @internal
 */
export interface IpcSocketBackend extends IpcSocket {
  /**
   * Establish a backend implementation for methods called via a channel.
   * @param channel The name of the channel for this handler. Must begin with the [[iTwinChannel]] prefix.
   * @param handler A function that supplies the implementation for methods invoked via `channel`
   * @returns A function to call to remove the handler.
   */
  handle: (channel: string, handler: (methodName: string, ...args: any[]) => Promise<any>) => RemoveFunction;
};

/**
 * All interfaces that specify methods invoked from the frontend and implemented on the backend via
 * Ipc must implement this interface.
 * @alpha
 */
export interface IpcInterface {
  /** Get a string that specifies the version of the interface. */
  getVersion(): Promise<string>;
};
