/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { renderHook } from "@testing-library/react-hooks";
import { useThrottledFn } from "../../../core-react/utils/hooks/useThrottledFn";

interface CallInfo {
  calls: number;
  timeBetweenCallsMs: number;
}

describe("useThrottledFn", () => {
  let clock: sinon.SinonFakeTimers;
  beforeEach(() => {
    clock = sinon.useFakeTimers({ now: Date.now() });
  });

  afterEach(() => {
    clock.restore();
  });

  function callThrottledFn(throttledFn: () => void, callInfo: CallInfo, runAll: boolean = true) {
    for (let times = 0; times < callInfo.calls; times++) {
      throttledFn();
      clock.tick(callInfo.timeBetweenCallsMs);
    }

    if (runAll)
      clock.runAll();
  }

  const testData = [
    { throttleTime: 7, callInfo: { calls: 5, timeBetweenCallsMs: 1 }, resultCalls: 1 },
    { throttleTime: 6, callInfo: { calls: 10, timeBetweenCallsMs: 1 }, resultCalls: 2 },
    { throttleTime: 20, callInfo: { calls: 5, timeBetweenCallsMs: 25 }, resultCalls: 5 },
  ];

  for (const test of testData) {
    const { resultCalls, calls, timeBetweenCallsMs, throttleTime } = { ...test.callInfo, ...test };

    it(`should call throttled (${throttleTime}ms) function ${resultCalls} times when called ${calls} times with delay of ${timeBetweenCallsMs}ms`, () => {
      const spy = sinon.spy();

      const { result } = renderHook(() => useThrottledFn(spy, throttleTime, []));
      callThrottledFn(result.current, test.callInfo);

      expect(spy.callCount).to.be.equal(resultCalls);
    });
  }

  it(`should not call throttled (7ms) function when called 5 times with delay of 1ms, clock did not run all and leading is false`, () => {
    const spy = sinon.spy();

    const { result } = renderHook(() => useThrottledFn(spy, 7, []));
    callThrottledFn(result.current, { calls: 5, timeBetweenCallsMs: 1 }, false);

    expect(spy.callCount).to.be.equal(0);
  });

  it(`should call throttled (7ms) function when called 5 times with delay of 1ms, clock did not run all and leading is true`, () => {
    const spy = sinon.spy();

    const { result } = renderHook(() => useThrottledFn(spy, 7, [], { leading: true, trailing: false }));
    callThrottledFn(result.current, { calls: 5, timeBetweenCallsMs: 1 }, false);

    expect(spy.callCount).to.be.equal(1);
  });

  it("should return new callback when dependencies change", () => {
    const spy = sinon.spy();

    const { result, rerender } = renderHook((props: { deps: boolean[] }) => useThrottledFn(spy, 20, props.deps),
      { initialProps: { deps: [false] } });

    const previousCallback = result.current;
    rerender({ deps: [true] });

    expect(result.current).to.not.be.equal(previousCallback);
  });
});
