/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IpcSocket
 */

export type IpcListener = (...arg: any[]) => void;
export type RemoveFunction = () => void;

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
