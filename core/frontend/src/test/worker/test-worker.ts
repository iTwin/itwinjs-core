/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { registerWorker } from "../../workers/RegisterWorker";

interface Zero {
  operation: "zero";
}

interface One {
  operation: "one";
  payload: string;
}

interface Two {
  operation: "two";
  payload: [number, number];
}

interface Throw {
  operation: "throwError";
}

registerWorker((request: Zero | One | Two | Throw) => {
  switch (request.operation) {
    case "zero": return "zero";
    case "throwError": throw new Error("ruh-roh");
    case "one": return request.payload;
    case "two": return request.payload[0] + request.payload[1];
  }
});

export interface TestWorker {
  zero(): "zero";
  one(s: string): string;
  two(a: number, b: number): number;
  throwError(): never;
}
