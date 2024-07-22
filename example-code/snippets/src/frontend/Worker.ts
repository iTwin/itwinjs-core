/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import { createWorkerProxy, registerWorker } from "@itwin/core-frontend";

interface TestWorker {
  zero(): "zero";
  one(s: string): string;
  two(a: number, b: number): number;
}

registerWorker<TestWorker>({
  zero: () => "zero",
  one: (arg: string) => arg,
  two: (args: [a: number, b: number]) => args[0] + args[1],
});

async function test() {
  const worker = createWorkerProxy<TestWorker>("./my-worker.js");
  assert(!worker.isTerminated);

  assert(await worker.zero() === "zero");
  assert(await worker.one("hello") === "hello");
  const sum = await worker.two([1, 2]);
  assert(sum === 3);

  worker.terminate();
  assert(worker.isTerminated);
}

const doTest = false;
if (doTest) {
  test();
}
