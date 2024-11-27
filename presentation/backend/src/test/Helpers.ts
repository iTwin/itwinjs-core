/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { ECSqlReader, QueryRowProxy } from "@itwin/core-common";

export function stubECSqlReader<TRow extends object>(rows: TRow[]): ECSqlReader {
  let stepsCount = -1;
  const step = async () => {
    return ++stepsCount < rows.length;
  };
  const getCurrent = (): QueryRowProxy => {
    if (stepsCount < 0 || stepsCount >= rows.length) {
      throw new Error("No current row");
    }
    return {
      ...rows[stepsCount],
      toRow: () => rows[stepsCount],
    } as unknown as QueryRowProxy;
  };
  const next = async (): Promise<IteratorResult<QueryRowProxy, any>> => {
    if (await step()) {
      return {
        done: false,
        value: getCurrent(),
      };
    }
    return {
      done: true,
      value: undefined,
    };
  };
  const iterator: AsyncIterableIterator<QueryRowProxy> = {
    next,
    [Symbol.asyncIterator](): AsyncIterableIterator<QueryRowProxy> {
      return iterator;
    },
  };
  return {
    ...iterator,
    step,
    get current() {
      return getCurrent();
    },
    async toArray() {
      return rows;
    },
  } as unknown as ECSqlReader;
}
