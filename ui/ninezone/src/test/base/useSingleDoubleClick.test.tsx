/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";
import { fireEvent } from "@testing-library/react";
import { act, renderHook } from "@testing-library/react-hooks";
import { useSingleDoubleClick } from "../../ui-ninezone";

// tslint:disable: completed-docs

describe("useSingleDoubleClick", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should invoke click handler", () => {
    const clickSpy = sinon.stub<NonNullable<Parameters<typeof useSingleDoubleClick>[0]>>();
    const doubleClickSpy = sinon.stub<NonNullable<Parameters<typeof useSingleDoubleClick>[1]>>();
    const { result } = renderHook(() => useSingleDoubleClick(clickSpy, doubleClickSpy));

    const element = document.createElement("div");
    act(() => {
      result.current(element);
      fireClick(element, sandbox.useFakeTimers());
    });

    clickSpy.calledOnceWithExactly().should.true;
    doubleClickSpy.notCalled.should.true;
  });

  it("should invoke double click handler", () => {
    const clickSpy = sinon.stub<NonNullable<Parameters<typeof useSingleDoubleClick>[0]>>();
    const doubleClickSpy = sinon.stub<NonNullable<Parameters<typeof useSingleDoubleClick>[1]>>();
    const { result } = renderHook(() => useSingleDoubleClick(clickSpy, doubleClickSpy));

    const element = document.createElement("div");
    act(() => {
      result.current(element);
      fireDoubleClick(element, sandbox.useFakeTimers());
    });

    clickSpy.notCalled.should.true;
    doubleClickSpy.calledOnceWithExactly().should.true;
  });
});

export function fireClick(element: Element, timers: sinon.SinonFakeTimers) {
  fireEvent.click(element);
  timers.tick(300);
}

export function fireDoubleClick(element: Element, timers: sinon.SinonFakeTimers) {
  fireEvent.click(element);
  fireEvent.click(element);
  timers.tick(300);
}
