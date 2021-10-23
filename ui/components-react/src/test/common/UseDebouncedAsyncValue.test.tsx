/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { renderHook } from "@testing-library/react-hooks";
import { useDebouncedAsyncValue } from "../../components-react/common/UseDebouncedAsyncValue";
import { ResolvablePromise } from "../test-helpers/misc";

describe("useDebouncedAsyncValue", () => {

  it("returns immediately when given `undefined`", async () => {
    const { result } = renderHook(
      (props: { value: undefined }) => useDebouncedAsyncValue(props.value),
      { initialProps: { value: undefined } },
    );
    expect(result.current.inProgress).to.be.false;
    expect(result.current.value).to.be.undefined;
  });

  it("returns value when promise resolves", async () => {
    const value = "some value";
    const valuePromise = new ResolvablePromise<string>();
    const { result } = renderHook(
      (props: { value: () => Promise<string> }) => useDebouncedAsyncValue(props.value),
      { initialProps: { value: async () => valuePromise } },
    );
    expect(result.current.inProgress).to.be.true;
    expect(result.current.value).to.be.undefined;

    await valuePromise.resolve(value);
    expect(result.current.inProgress).to.be.false;
    expect(result.current.value).to.eq(value);
  });

  it("returns the last value when argument changes multiple times", async () => {
    const initialPromise = new ResolvablePromise<number>();
    const { result, rerender } = renderHook(
      (props: { value: () => Promise<number> }) => useDebouncedAsyncValue(props.value),
      { initialProps: { value: async () => initialPromise } },
    );
    expect(result.current.inProgress).to.be.true;
    expect(result.current.value).to.be.undefined;

    rerender({ value: async () => 1 });
    rerender({ value: async () => 2 });
    await initialPromise.resolve(0);

    expect(result.current.inProgress).to.be.false;
    expect(result.current.value).to.eq(2);
  });

});
