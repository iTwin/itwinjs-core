/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { ECSqlReader } from "@itwin/core-common";

export function stubECSqlReader<TRow extends {}>(rows: TRow[]) {
  let stepsCount = -1;
  return {
    async step() {
      return ++stepsCount < rows.length;
    },
    get current() {
      return stepsCount >= 0 && stepsCount < rows.length ? { toRow: () => rows[stepsCount] } : undefined;
    },
    async toArray() {
      return rows;
    },
  } as unknown as ECSqlReader;
}
