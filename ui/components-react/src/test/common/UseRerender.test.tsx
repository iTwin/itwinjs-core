/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useLayoutEffect } from "react";
import { useRerender } from "../../components-react/common/UseRerender";
import { act } from "@testing-library/react";
import { renderHook } from "@testing-library/react-hooks";
import { expect } from "chai";

describe("useRerender", () => {
  it("starts counting rerenders from 0", () => {
    const { result } = renderHook(() => useRerender());
    expect(result.current.numRerenders).to.equal(0);
  });

  it("rerenders component immediately when request is made within useLayoutEffect", () => {
    const { result } = renderHook(() => {
      const { numRerenders, rerender } = useRerender();
      useLayoutEffect(() => {
        if (numRerenders === 0) {
          rerender();
        }
      });

      return numRerenders;
    });

    expect(result.current).to.equal(1);
  });

  it("rerenders component when request is made after paint", () => {
    const { result } = renderHook(() => useRerender());
    act(() => result.current.rerender());
    expect(result.current.numRerenders).to.equal(1);
  });

  it("provides initial rerender context on initial render", () => {
    const { result } = renderHook(() => useRerender("initial context"));
    expect(result.current.rerenderContext).to.equal("initial context");
  });

  it("provides rerender context from last rerender request", () => {
    const { result } = renderHook(() => useRerender("first render"));
    act(() => result.current.rerender("second render"));
    expect(result.current.rerenderContext).to.equal("second render");
  });

  it("resets rerender context on next render if rerender was not requested", () => {
    const { result, rerender } = renderHook(() => useRerender("initial context"));
    act(() => result.current.rerender("altered context"));
    rerender();
    expect(result.current.rerenderContext).to.equal("initial context");
  });
});
