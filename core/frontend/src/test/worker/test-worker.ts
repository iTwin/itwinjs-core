/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { registerWorker } from "../../workers/RegisterWorker";

export interface TestWorker {
  zero(): "zero";
  one(s: string): string;
  two(a: number, b: number): number;
  throwError(): never;
  throwString(): never;
  setTransfer(wantTransfer: boolean): undefined;
}

let doTransfer = false;

function maybeTransfer<T>(result: T): T | { result: T, transfer: Transferable[] } {
  if (!doTransfer)
    return result;

  return { result, transfer: [] };
}

registerWorker<TestWorker>({
  zero: () => maybeTransfer("zero"),
  one: (arg: string) => maybeTransfer(arg),
  two: (args: [a: number, b: number]) => maybeTransfer(args[0] + args[1]),
  throwError: () => {
    throw new Error("ruh-roh");
  },
  throwString: () => {
    throw "not an error"; // eslint-disable-line no-throw-literal
  },
  setTransfer: (wantTransfer: boolean) => {
    doTransfer = wantTransfer;
    return undefined;
  },
});
