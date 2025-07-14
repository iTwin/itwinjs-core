/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/**
 * Modifies interface in a way so that IpcHandlers would have enough information to identify the iModel
 * @beta
 */
export type IpcAdapted<T> = {
  [K in keyof T]: T[K] extends (...args: infer Args) => infer R ? (key: string, ...args: Args) => R : T[K];
};
