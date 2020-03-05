/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { renderHook, act } from "@testing-library/react-hooks";
import { useRefs } from "../../../ui-core/utils/hooks/useRefs";

describe("useRefs", () => {
  it("should set ref objects and invoke ref callbacks", () => {
    let ref: React.RefObject<string | null> = { current: null };
    let mutableRef: React.MutableRefObject<string | null> = { current: null };
    const callbackRef = sinon.spy((_: string | null) => { });
    const { result } = renderHook(() => {
      ref = React.useRef<string>(null);
      mutableRef = React.useRef<string | null>(null);
      return useRefs(ref, mutableRef, callbackRef);
    });
    act(() => {
      result.current("abc");
    });

    ref.current!.should.eq("abc");
    mutableRef.current!.should.eq("abc");
    callbackRef.calledOnceWithExactly("abc").should.true;
  });
});
