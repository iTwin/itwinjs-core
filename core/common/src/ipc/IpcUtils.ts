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

/**
 * Creates an async iterable from an IPC function that returns next iterable based on identifier
 * @param queryId Identifier of the query from which to return the next value
 * @param nextFn Function that returns the next value in the iterable based on the identifier
 * @beta
 */
export function getIpcIterable<T>(
  queryId: string,
  nextFn: (queryId: string) => Promise<IteratorResult<T, void>>,
): AsyncIterable<T> {
  const next = async () => nextFn(queryId);
  return {
    [Symbol.asyncIterator]: () => ({ next })
  };
}
