/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { DelayedPromise, DelayedPromiseWithProps } from "../../DelayedPromise";

describe("DelayedPromise", () => {
  it("should not start until awaited", async () => {
    const asyncOp = sinon.spy(async () => 42);
    const promise = new DelayedPromise(asyncOp);

    expect(asyncOp.notCalled).toBe(true);
    expect(await promise).toEqual(42);
    expect(asyncOp.calledOnce).toBe(true);
  });

  it("should not start until manually started", async () => {
    const asyncOp = sinon.spy(async () => 76);
    const promise = new DelayedPromise(asyncOp);

    expect(asyncOp.notCalled).toBe(true);
    await expect(promise.start()).to.eventually.equal(76);
    expect(asyncOp.calledOnce).toBe(true);
  });

  it("should not start until a resolution callback is attached", async () => {
    const asyncOp = sinon.spy(async () => 20);
    const promise = new DelayedPromise(asyncOp);
    const callback = sinon.spy((_: number) => "foo");

    expect(asyncOp.notCalled).toBe(true);
    expect(await promise.then(callback)).toEqual("foo");
    expect(asyncOp.calledOnce).toBe(true);

    expect(callback.calledOnce).toBe(true);
    expect(callback.calledWithExactly(20)).toBe(true);
  });

  it("should not start until a rejection callback is attached", async () => {
    const error = new Error("I like to throw things");
    const asyncOp = sinon.spy(async () => {
      throw error;
    });

    const promise = new DelayedPromise(asyncOp);
    const callback = sinon.spy((_: Error) => "bar");

    expect(asyncOp.notCalled).toBe(true);
    expect(await promise.catch(callback)).toEqual("bar");
    expect(asyncOp.calledOnce).toBe(true);

    expect(callback.calledOnce).toBe(true);
    expect(callback.calledWithExactly(error)).toBe(true);
  });

  it("should only ever start once", async () => {
    const asyncOp = sinon.spy(async () => "foo");
    const promise = new DelayedPromise(asyncOp);

    expect(asyncOp.notCalled).toBe(true);
    expect(await promise).toEqual("foo");
    expect(await promise).toEqual("foo");
    await expect(promise).to.eventually.equal("foo");
    await expect(promise).to.eventually.equal("foo");
    await expect(promise.start()).to.eventually.equal("foo");
    await expect(promise.start()).to.eventually.equal("foo");
    expect(asyncOp.calledOnce).toBe(true);
  });
});

describe("DelayedPromiseWithProps", () => {
  class Base {
    public get inheritedGetter() { return "value"; }
    public inheritedMethod() { return "something"; }
    public overriddenMethod() { return "this"; }
  }
  class PropsClass extends Base {
    public realProp = true;
    public get getterProp() { return 5; }
    public classMethod() { return 42; }
    public override overriddenMethod() { return "that"; }
  }

  it("should contain getters for all added properties", async () => {
    const props = new PropsClass();

    const promise = new DelayedPromiseWithProps(props, async () => undefined);
    expect(promise.realProp).toBe(true);
    expect(promise.getterProp).toEqual(5);
    expect(promise.classMethod).to.exist;
    expect(promise.classMethod()).toEqual(42);
    expect(promise.inheritedGetter).toEqual("value");
    expect(promise.inheritedMethod).to.exist;
    expect(promise.inheritedMethod()).toEqual("something");
    expect(promise.overriddenMethod).to.exist;
    expect(promise.overriddenMethod()).toEqual("that");

    props.realProp = false;
    expect(promise.realProp).toBe(false);
  });
});
