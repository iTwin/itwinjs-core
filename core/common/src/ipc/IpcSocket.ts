/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IpcSocket
 */

export const iTwinChannel = (channel: string) => `itwin.${channel}`;

export type IpcListener = (evt: any, ...arg: any[]) => void;
export type RemoveFunction = () => void;
export type IpcInvokeReturn = { result: any, error?: never } | { result?: never, error: { name: string, message: string, errorNumber: number } };

export interface IpcSocket {
  send: (channel: string, ...data: any[]) => void;
  receive: (channel: string, listener: IpcListener) => RemoveFunction;
}

export interface IpcSocketFrontend extends IpcSocket {
  invoke: (channel: string, ...args: any[]) => Promise<any>;
};

export interface IpcSocketBackend extends IpcSocket {
  handle: (channel: string, listener: (...args: any[]) => Promise<any>) => RemoveFunction;
};

export interface IpcInterface {
  getVersion(): Promise<string>;
};
