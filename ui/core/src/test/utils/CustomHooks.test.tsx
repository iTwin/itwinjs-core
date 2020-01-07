/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { renderHook } from "@testing-library/react-hooks";
import { useEffectSkipFirst } from "../../ui-core/utils/CustomHooks";

describe("useEffectSkipFirst", () => {

  it("does not invoke callback on first effect", () => {
    const spy = sinon.spy();
    renderHook(
      (props: { callback: () => void, deps?: any[] }) => useEffectSkipFirst(props.callback, props.deps),
      { initialProps: { callback: spy, deps: [true] } },
    );

    expect(spy).to.not.be.called;
  });

  it("invokes callback when dependencies change", () => {
    const spy = sinon.spy();
    const { rerender } = renderHook(
      (props: { callback: () => void, deps?: any[] }) => useEffectSkipFirst(props.callback, props.deps),
      { initialProps: { callback: spy, deps: [true] } },
    );

    expect(spy).to.not.be.called;

    rerender({ callback: spy, deps: [false] });

    expect(spy).to.be.calledOnce;
  });

});
