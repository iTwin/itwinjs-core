/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { renderHook } from "@testing-library/react-hooks";
import { useEffectSkipFirst, useDisposable } from "../../ui-core/utils/CustomHooks";
import { IDisposable } from "@bentley/bentleyjs-core";

describe("useEffectSkipFirst", () => {

  it("does not invoke callback on first effect", () => {
    const spy = sinon.spy();
    renderHook(
      (props: { callback: () => void, deps?: any[] }) => useEffectSkipFirst(props.callback, props.deps),
      { initialProps: { callback: spy, deps: [true] } },
    );

    expect(spy).to.not.be.called;
  });

  it("does not invoke cleanup if callback was not invoked", () => {
    const cleanupSpy = sinon.spy();
    const callback = () => cleanupSpy;
    const { unmount } = renderHook(
      (props: { callback: () => void, deps?: any[] }) => useEffectSkipFirst(props.callback, props.deps),
      { initialProps: { callback, deps: [true] } },
    );

    unmount();

    expect(cleanupSpy).to.not.be.called;
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

  it("invokes cleanup if callback was invoked", () => {
    const cleanupSpy = sinon.spy();
    let callbackInvokeCount = 0;
    const callback = () => {
      callbackInvokeCount++;
      return cleanupSpy;
    };

    const { rerender, unmount } = renderHook(
      (props: { callback: () => void, deps?: any[] }) => useEffectSkipFirst(props.callback, props.deps),
      { initialProps: { callback, deps: [true] } },
    );

    // first render, useEffect is skipped
    expect(callbackInvokeCount).to.be.eq(0);

    // second render, different dependencies
    // callback is invoked for first time
    rerender({ callback, deps: [false] });
    expect(callbackInvokeCount).to.be.eq(1);
    expect(cleanupSpy).to.not.be.called;

    // unmounted
    // cleanup after callback invocation
    unmount();
    expect(callbackInvokeCount).to.be.eq(1);
    expect(cleanupSpy).to.be.calledOnce;
  });

  it("invokes cleanup if callback was invoked multiple times", () => {
    const cleanupSpy = sinon.spy();
    let callbackInvokeCount = 0;
    const callback = () => {
      callbackInvokeCount++;
      return cleanupSpy;
    };

    const { rerender, unmount } = renderHook(
      (props: { callback: () => void, deps?: any[] }) => useEffectSkipFirst(props.callback, props.deps),
      { initialProps: { callback, deps: [true] } },
    );

    // first render useEffect is skipped
    expect(callbackInvokeCount).to.be.eq(0);
    expect(cleanupSpy).to.not.be.called;

    // second render different dependencies
    // callback is invoked first time
    rerender({ callback, deps: [false] });
    expect(callbackInvokeCount).to.be.eq(1);
    expect(cleanupSpy).to.not.be.called;

    // third render different dependencies
    // cleanup after first callback invocation
    // invoke callback second time
    rerender({ callback, deps: [true] });
    expect(callbackInvokeCount).to.be.eq(2);
    expect(cleanupSpy).to.be.calledOnce;

    // unmount
    // cleanup after second callback invocation
    unmount();
    expect(callbackInvokeCount).to.be.eq(2);
    expect(cleanupSpy).to.be.calledTwice;
  });

});

describe("useDisposable", () => {
  let disposeSpy: sinon.SinonSpy<any, any[]>;
  let createDisposable: () => IDisposable;

  beforeEach(() => {
    disposeSpy = sinon.spy();
    createDisposable = () => ({ dispose: disposeSpy });
  });

  it("creates disposable and disposes it on unmount", () => {
    const { result, unmount } = renderHook(
      (props: { createDisposable: () => IDisposable }) => useDisposable(props.createDisposable),
      { initialProps: { createDisposable } },
    );
    expect(result.current).to.not.be.undefined;

    unmount();
    expect(disposeSpy).to.be.calledOnce;
  });

  it("disposes old disposable when creating new one", () => {
    const { result, rerender } = renderHook(
      (props: { createDisposable: () => IDisposable }) => useDisposable(props.createDisposable),
      { initialProps: { createDisposable } },
    );
    expect(result.current).to.not.be.undefined;

    const oldDisposable = result.current;
    const newDisposeSpy = sinon.spy();
    const createNewDisposable = () => ({ dispose: newDisposeSpy });
    rerender({ createDisposable: createNewDisposable });

    expect(oldDisposable).to.not.be.eq(result.current);
    expect(disposeSpy).to.be.calledOnce;
    expect(newDisposeSpy).to.not.be.called;
  });

});
