/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as Benchmark from "benchmark";

/* eslint-disable no-console */
export async function comparePerformance(...funcs: Array<() => Promise<any>>): Promise<void> {
  const suite = new Benchmark.Suite();
  return new Promise((resolve) => {

    funcs.forEach((testFunc, i) => {
      suite.add(testFunc.name || String.fromCharCode(65 + i), {
        defer: true,
        async fn(deferred: any) {
          await testFunc();
          deferred.resolve();
        },
      });
    });
    suite.on("cycle", (event: any) => {
      console.log(String(event.target));
    });
    suite.on("complete", function (this: any) {
      console.log(`Fastest is ${this.filter("fastest").map("name")}`);
      resolve();
    });
    suite.run({ async: false });
  });
}

export function comparePerformanceSync(...funcs: Array<() => any>): void {
  const suite = new Benchmark.Suite();

  funcs.forEach((testFunc, i) => {
    suite.add(testFunc.name || String.fromCharCode(65 + i), testFunc);
  });
  suite.on("cycle", (event: any) => {
    console.log(String(event.target));
  });
  suite.on("complete", function (this: any) {
    console.log(`Fastest is ${this.filter("fastest").map("name")}`);
  });
  suite.run({ async: false });
}
