/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";
import { renderHook } from "@testing-library/react-hooks";
import { useInterval } from "../../../core-react";

describe("useInterval", () => {

  it("should call interval's callback when timeout is reached", () => {
    const clock = sinon.useFakeTimers();
    const spy = sinon.spy();
    const delay = 100;
    renderHook(() => useInterval(spy, delay));

    // Advance clock by to the same number of tick as the internal delay.
    clock.tick(delay);
    clock.restore();

    spy.calledOnce.should.true;
  });

  it("should NOT call interval's callback when timeout has not been reached yet", () => {
    const clock = sinon.useFakeTimers();
    const spy = sinon.spy();
    renderHook(() => useInterval(spy, 100));

    // Advance clock by only 50 clicks, so interval should not have reached time out
    clock.tick(50);
    clock.restore();

    spy.calledOnce.should.false;
  });

});
