/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";
import { act, renderHook } from "@testing-library/react-hooks";
import { useRefEffect } from "../../../core-react/utils/hooks/useRefEffect";

describe("useRefEffect", () => {
  it("should invoke callback", () => {
    const callback = sinon.spy((_: string | null) => { });
    const { result } = renderHook(() => useRefEffect(callback, []));
    act(() => { // eslint-disable-line @typescript-eslint/no-floating-promises
      result.current("abc");
    });

    callback.calledOnceWithExactly("abc").should.true;
  });

  it("should invoke cleanup", () => {
    const cleanups = new Array<{ instance: string | null, cleanup: sinon.SinonSpy<[], void> }>();
    const createCleanup = (instance: string | null) => {
      const cleanup = sinon.spy(() => { });
      cleanups.push({ instance, cleanup });
      return cleanup;
    };
    const callback = sinon.spy((instance: string | null) => {
      const cleanup = createCleanup(instance);
      return cleanup;
    });
    const { result } = renderHook(() => useRefEffect(callback, []));
    act(() => { // eslint-disable-line @typescript-eslint/no-floating-promises
      result.current("abc");
    });
    act(() => { // eslint-disable-line @typescript-eslint/no-floating-promises
      result.current("abcd");
    });

    cleanups.length.should.eq(2);
    cleanups[0].instance!.should.eq("abc");
    cleanups[0].cleanup.calledOnceWithExactly().should.true;

    cleanups[1].instance!.should.eq("abcd");
    cleanups[1].cleanup.notCalled.should.true;
  });
});
