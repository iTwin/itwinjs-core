/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { renderHook } from "@testing-library/react-hooks";
import { useAsyncValue } from "../../components-react/common/UseAsyncValue";
import { ResolvablePromise } from "../test-helpers/misc";

describe("useAsyncValue", () => {

  it("returns synchronous value", () => {
    const value = "some value";
    const { result } = renderHook((props: { value: string }) => useAsyncValue(props.value), { initialProps: { value } });
    expect(result.current).to.be.eq(value);
  });

  it("returns value when promise resolves", async () => {
    const value = "some value";
    const valuePromise = Promise.resolve(value);
    const { result } = renderHook((props: { value: Promise<string> }) => useAsyncValue(props.value), { initialProps: { value: valuePromise } });
    expect(result.current).to.be.undefined;
    await valuePromise;
    expect(result.current).to.be.eq(value);
  });

  it("returns correct value from multiple promises", async () => {
    const initialPromise = new ResolvablePromise<string>();
    const updatePromise = new ResolvablePromise<string>();
    const { result, rerender } = renderHook((props: { value: PromiseLike<string> }) => useAsyncValue(props.value), { initialProps: { value: initialPromise } });
    expect(result.current).to.be.undefined;
    rerender({ value: updatePromise });
    expect(result.current).to.be.undefined;
    await updatePromise.resolve("updated value");
    expect(result.current).to.be.eq("updated value");
    await initialPromise.resolve("initial value");
    expect(result.current).to.be.eq("updated value");
  });

});
