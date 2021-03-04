/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { act, renderHook } from "@testing-library/react-hooks";
import { mergeRefs, useRefs } from "../../../ui-core/utils/hooks/useRefs";

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
    act(() => { // eslint-disable-line @typescript-eslint/no-floating-promises
      result.current("abc");
    });

    ref.current!.should.eq("abc");
    mutableRef.current!.should.eq("abc");
    callbackRef.calledOnceWithExactly("abc").should.true;
  });
});

describe("mergeRefs", () => {
  it("should set ref objects and invoke ref callbacks", () => {
    let ref: React.RefObject<string | null> = { current: null };
    let mutableRef: React.MutableRefObject<string | null> = { current: null };
    const callbackRef = sinon.spy((_: string | null) => { });
    const { result } = renderHook(() => {
      ref = React.useRef<string>(null);
      mutableRef = React.useRef<string | null>(null);
      return mergeRefs(ref, mutableRef, callbackRef);
    });
    act(() => { // eslint-disable-line @typescript-eslint/no-floating-promises
      result.current("abc");
    });

    ref.current!.should.eq("abc");
    mutableRef.current!.should.eq("abc");
    callbackRef.calledOnceWithExactly("abc").should.true;
  });
});
