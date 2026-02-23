/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it, vi } from "vitest";
import { DelayedPromise, DelayedPromiseWithProps } from "../../DelayedPromise";

describe("DelayedPromise", () => {
  it("should not start until awaited", async () => {
    const asyncOp = vi.fn(async () => 42);
    const promise = new DelayedPromise(asyncOp);

    expect(asyncOp).not.toHaveBeenCalled();
    expect(await promise).toEqual(42);
    expect(asyncOp).toHaveBeenCalledOnce();
  });

  it("should not start until manually started", async () => {
    const asyncOp = vi.fn(async () => 76);
    const promise = new DelayedPromise(asyncOp);

    expect(asyncOp).not.toHaveBeenCalled();
    await expect(promise.start()).resolves.toEqual(76);
    expect(asyncOp).toHaveBeenCalledOnce();
  });

  it("should not start until a resolution callback is attached", async () => {
    const asyncOp = vi.fn(async () => 20);
    const promise = new DelayedPromise(asyncOp);
    const callback = vi.fn((_: number) => "foo");

    expect(asyncOp).not.toHaveBeenCalled();
    expect(await promise.then(callback)).toEqual("foo");
    expect(asyncOp).toHaveBeenCalledOnce();

    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith(20);
  });

  it("should not start until a rejection callback is attached", async () => {
    const error = new Error("I like to throw things");
    const asyncOp = vi.fn(async () => {
      throw error;
    });

    const promise = new DelayedPromise(asyncOp);
    const callback = vi.fn((_: Error) => "bar");

    expect(asyncOp).not.toHaveBeenCalled();
    expect(await promise.catch(callback)).toEqual("bar");
    expect(asyncOp).toHaveBeenCalledOnce();

    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith(error);
  });

  it("should only ever start once", async () => {
    const asyncOp = vi.fn(async () => "foo");
    const promise = new DelayedPromise(asyncOp);

    expect(asyncOp).not.toHaveBeenCalled();
    expect(await promise).toEqual("foo");
    expect(await promise).toEqual("foo");
    await expect(promise).resolves.toEqual("foo");
    await expect(promise).resolves.toEqual("foo");
    await expect(promise.start()).resolves.toEqual("foo");
    await expect(promise.start()).resolves.toEqual("foo");
    expect(asyncOp).toHaveBeenCalledOnce();
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
    expect(promise.classMethod.bind(promise)).toBeDefined();
    expect(promise.classMethod()).toEqual(42);
    expect(promise.inheritedGetter).toEqual("value");
    expect(promise.inheritedMethod.bind(promise)).toBeDefined();
    expect(promise.inheritedMethod()).toEqual("something");
    expect(promise.overriddenMethod.bind(promise)).toBeDefined();
    expect(promise.overriddenMethod()).toEqual("that");

    props.realProp = false;
    expect(promise.realProp).toBe(false);
  });
});
