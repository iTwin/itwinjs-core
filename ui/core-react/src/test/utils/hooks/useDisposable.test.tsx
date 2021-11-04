/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { IDisposable } from "@itwin/core-bentley";
import { renderHook } from "@testing-library/react-hooks";
import { useDisposable } from "../../../core-react/utils/hooks/useDisposable";

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
