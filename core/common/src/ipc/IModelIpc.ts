/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module SocketApi
 */

export type Listener = (...arg: any[]) => void;
export type RemoveFunction = () => void;

export abstract class IModelIPc {
  public abstract addListener(channel: string, listener: Listener): RemoveFunction;
  public abstract addOnce: (channel: string, listener: Listener) => RemoveFunction;
  public abstract removeListener: (channel: string, listener: Listener) => void;
  public abstract send: (channel: string, ...data: any[]) => void;
};

export abstract class FrontendIpc extends IModelIPc {
  public abstract invoke(channel: string, ...args: any[]): Promise<any>;
};

export abstract class BackendIpc extends IModelIPc {
  public abstract handle(channel: string, ...args: any[]): Promise<any>;
};
