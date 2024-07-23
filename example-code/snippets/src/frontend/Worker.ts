/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "@itwin/core-bentley";
import { createWorkerProxy, registerWorker } from "@itwin/core-frontend";

// __PUBLISH_EXTRACT_START__ Worker_CalculatorInterface
interface Calculator {
  /** Returns the constant PI. */
  pi(): number;
  /** Returns the square root of `num`. Throws an error if `num` is less than zero. */
  squareRoot(num: number): number;
  /** Returns the sum of `a` and `b`. */
  add(a: number, b: number): number;
  /** Divides each of the `numbers` by the specified `divisor`. */
  divideAll(numbers: Float64Array, divisor: number): Float64Array;
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ Worker_CalculatorImplementation

registerWorker<Calculator>({
  pi: () => Math.PI,
  squareRoot: (num) => {
    if (num < 0) {
      throw new Error("squareRoot requires a non-negative input");
    }

    return Math.sqrt(num);
  },
  add: (args: [a: number, b: number]) => {
    return args[0] + args[1];
  },
  divideAll: (args: [numbers: Float64Array, divisor: number]) => {
    const result = args[0];
    const divisor = args[1];
    for (let i = 0; i < result.length; i++) {
      result[i] = result[i] / divisor;
    }

    const transfer = [result.buffer];
    return { result, transfer };
  },
});
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ Worker_CalculatorProxy
interface CalculatorProxy {
  pi(transfer?: Transferable[]): Promise<number>;
  squareRoot(num: number, transfer?: Transferable[]): Promise<number>;
  add(args: [a: number, b: number], transfer?: Transferable[]): Promise<number>;
  divideAll(args: [numbers: Float64Array, divisor: number], transfer?: Transferable[]): Promise<Float64Array>;
  /** From WorkerProxy, terminates the Worker. */
  terminate(): void;
  /** From WorkerProxy, true if `terminate` has been called. */
  readonly isTerminated: boolean;
}
// __PUBLISH_EXTRACT_END__

async function testCalculator() {
  const calculator2: CalculatorProxy = createWorkerProxy<Calculator>("./calculator.js");
  assert(!calculator2.isTerminated);
  // __PUBLISH_EXTRACT_START__ Worker_CreateCalculatorProxy
  const calculator = createWorkerProxy<Calculator>("./calculator.js");
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ Worker_UseCalculator
  const pi = await calculator.pi();
  assert(pi === Math.PI);

  const three = await calculator.squareRoot(9);
  assert(three === 3);

  const five = await calculator.add([2, 3]);
  assert(five === 5);
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ Worker_CalculatorTransfer
  const numbers = new Float64Array([1, 2, 3, 4, 5, 6, 7]);
  const result = await calculator.divideAll([numbers, 2], [numbers.buffer]);
  assert(result.length === 7);
  assert(result[0] === 0.5);
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ Worker_TerminateCalculatorProxy
  calculator.terminate();
  assert(calculator.isTerminated);
// __PUBLISH_EXTRACT_END__
}

const doTest = false;
if (doTest) {
  testCalculator(); // eslint-disable-line @typescript-eslint/no-floating-promises
}
