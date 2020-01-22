/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { renderHook, act } from "@testing-library/react-hooks";
import { PointerCaptor, usePointerCaptor } from "../../ui-ninezone";

describe("<PointerCaptor />", () => {
  it("should render", () => {
    mount(<PointerCaptor isPointerDown={false} />);
  });

  it("renders correctly", () => {
    shallow(<PointerCaptor isPointerDown={false} />).should.matchSnapshot();
  });

  it("should respect isPointerDown prop over state", () => {
    shallow(<PointerCaptor isPointerDown />).should.matchSnapshot();
  });

  it("should unmount", () => {
    const sut = mount(<PointerCaptor isPointerDown={false} />);
    sut.unmount();
  });

  it("should call pointer down prop", () => {
    const spy = sinon.spy();
    const sut = mount(<PointerCaptor isPointerDown={false} onPointerDown={spy} />);
    sut.simulate("pointerDown");

    spy.calledOnce.should.true;
  });

  it("should call pointer up if pointer is down", () => {
    const spy = sinon.spy();
    mount(<PointerCaptor isPointerDown onPointerUp={spy} />);

    const pointerUp = document.createEvent("HTMLEvents");
    pointerUp.initEvent("pointerup");
    document.dispatchEvent(pointerUp);

    spy.calledOnce.should.true;
  });

  it("should call pointer move if pointer is down", () => {
    const spy = sinon.spy();
    const sut = mount(<PointerCaptor isPointerDown onPointerMove={spy} />);
    sut.simulate("pointerDown");

    const pointerMove = document.createEvent("HTMLEvents");
    pointerMove.initEvent("pointermove");
    document.dispatchEvent(pointerMove);

    spy.calledOnce.should.true;
  });
});

describe("usePointerCaptor", () => {
  it("should call onPointerDown", () => {
    const spy = sinon.spy(); // as SinonSpy<NonNullable<Parameters<typeof usePointerCaptor>[0]>>;
    const { result } = renderHook(() => usePointerCaptor(spy));
    const captured = document.createElement("div");
    act(() => {
      result.current(captured);
    });

    const pointerDown = document.createEvent("HTMLEvents");
    pointerDown.initEvent("pointerdown");
    captured.dispatchEvent(pointerDown);

    spy.calledOnceWithExactly().should.true;
  });

  it("should remove pointerdown event listener", () => {
    const { result } = renderHook(() => usePointerCaptor());
    const captured = document.createElement("div");
    const spy = sinon.spy(captured, "removeEventListener");
    act(() => {
      result.current(captured);
    });
    act(() => {
      result.current(null);
    });

    spy.calledOnceWithExactly("pointerdown", sinon.match.any).should.true;
  });

  it("should call onPointerMove", () => {
    const spy = sinon.spy(); // as SinonSpy<NonNullable<Parameters<typeof usePointerCaptor>[1]>>;
    const { result } = renderHook(() => usePointerCaptor(undefined, spy));
    const captured = document.createElement("div");
    act(() => {
      result.current(captured);
    });

    const pointerDown = document.createEvent("HTMLEvents");
    pointerDown.initEvent("pointerdown");
    captured.dispatchEvent(pointerDown);

    const pointerMove = document.createEvent("HTMLEvents");
    pointerMove.initEvent("pointermove");
    document.dispatchEvent(pointerMove);

    spy.calledOnceWithExactly().should.true;
  });

  it("should call onPointerUp", () => {
    const spy = sinon.spy(); // as SinonSpy<NonNullable<Parameters<typeof usePointerCaptor>[2]>>;
    const { result } = renderHook(() => usePointerCaptor(undefined, undefined, spy));
    const captured = document.createElement("div");
    act(() => {
      result.current(captured);
    });

    const pointerDown = document.createEvent("HTMLEvents");
    pointerDown.initEvent("pointerdown");
    captured.dispatchEvent(pointerDown);

    const pointerUp = document.createEvent("HTMLEvents");
    pointerUp.initEvent("pointerup");
    document.dispatchEvent(pointerUp);

    spy.calledOnceWithExactly().should.true;
  });
});
