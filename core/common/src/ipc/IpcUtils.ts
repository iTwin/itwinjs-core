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
 * Wraps two IPC functions into an async iterable
 * @param initFn Function that initializes the iterable and returns an identifier
 * @param nextFn Function that returns the next value in the iterable based on the identifier
 * @beta
 */
export function getIpcIterable<T, MetaDataType = unknown>(
  initFn: () => Promise<string>,
  nextFn: (queryId: string) => Promise<IteratorResult<T, void>>,
  metadataFn: (queryId: string) => Promise<MetaDataType[]>
): AsyncIterable<T> & { meta: () => Promise<MetaDataType[]> } {
  const queryId = initFn();

  const next = async () => nextFn(await queryId);
  const meta = async () => metadataFn(await queryId);
  return {
    [Symbol.asyncIterator]: () => ({ next }),
    meta
  };
}
