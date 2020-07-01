/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { act, renderHook } from "@testing-library/react-hooks";
import { PointerCaptor, usePointerCaptor } from "../../ui-ninezone";
import { fireEvent } from "@testing-library/react";
import { DragManagerProvider } from "../Providers";

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
  const wrapper = DragManagerProvider;

  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should call onPointerDown", () => {
    const spy = sinon.stub<NonNullable<Parameters<typeof usePointerCaptor>[0]>>();
    const { result } = renderHook(() => usePointerCaptor(spy));
    const element = document.createElement("div");
    act(() => {
      result.current(element);
    });

    fireEvent.mouseDown(element);

    spy.calledOnce.should.true;
  });

  it("should call onPointerMove", () => {
    const spy = sinon.stub<NonNullable<Parameters<typeof usePointerCaptor>[1]>>();
    const { result } = renderHook(() => usePointerCaptor(undefined, spy));
    const element = document.createElement("div");
    act(() => {
      result.current(element);
    });

    fireEvent.mouseDown(element);
    fireEvent.mouseMove(document);

    spy.calledOnce.should.true;
  });

  it("should call onPointerUp", () => {
    const spy = sinon.stub<NonNullable<Parameters<typeof usePointerCaptor>[2]>>();
    const { result } = renderHook(() => usePointerCaptor(undefined, undefined, spy));
    const element = document.createElement("div");
    act(() => {
      result.current(element);
    });

    fireEvent.mouseDown(element);
    fireEvent.mouseUp(document);

    spy.calledOnce.should.true;
  });

  it("should call onPointerDown for touchstart", () => {
    const spy = sinon.stub<NonNullable<Parameters<typeof usePointerCaptor>[0]>>();
    const { result } = renderHook(() => usePointerCaptor(spy), { wrapper });
    const element = document.createElement("div");
    act(() => {
      result.current(element);
      fireEvent.touchStart(element, {
        touches: [{}],
      });
    });

    spy.calledOnce.should.true;
  });

  it("should call onPointerMove for touchmove", () => {
    const spy = sinon.stub<NonNullable<Parameters<typeof usePointerCaptor>[1]>>();
    const { result } = renderHook(() => usePointerCaptor(undefined, spy), { wrapper });
    const element = document.createElement("div");
    act(() => {
      result.current(element);
      fireEvent.touchStart(element, {
        touches: [{}],
      });
      fireEvent.touchMove(element, {
        touches: [{}],
      });
    });

    spy.calledOnce.should.true;
  });

  it("should call onPointerUp for touchend", () => {
    const spy = sinon.stub<NonNullable<Parameters<typeof usePointerCaptor>[2]>>();
    const { result } = renderHook(() => usePointerCaptor(undefined, undefined, spy), { wrapper });
    const element = document.createElement("div");
    act(() => {
      result.current(element);
      fireEvent.touchStart(element, {
        touches: [{}],
      });
      fireEvent.touchEnd(element, {
        touches: [{}],
      });
    });
    spy.calledOnce.should.true;

    act(() => {
      result.current(null);
    });
  });

  it("should not call onPointerDown when touches.length !== 1", () => {
    const spy = sinon.stub<NonNullable<Parameters<typeof usePointerCaptor>[0]>>();
    const { result } = renderHook(() => usePointerCaptor(spy));
    const element = document.createElement("div");
    act(() => {
      result.current(element);
      fireEvent.touchStart(element, {
        touches: [],
      });
    });

    spy.notCalled.should.true;
  });

  it("should not call onPointerMove when touches.length !== 1", () => {
    const spy = sinon.stub<NonNullable<Parameters<typeof usePointerCaptor>[1]>>();
    const { result } = renderHook(() => usePointerCaptor(undefined, spy), { wrapper });
    const element = document.createElement("div");
    act(() => {
      result.current(element);
      fireEvent.touchStart(element, {
        touches: [{}],
      });
      fireEvent.touchMove(element, {
        touches: [],
      });
    });

    spy.notCalled.should.true;
  });

  it("should not add target touch listeners", () => {
    const { result } = renderHook(() => usePointerCaptor(), { wrapper });
    const element = document.createElement("div");

    act(() => {
      result.current(element);
    });

    const spy = sandbox.spy(HTMLElement.prototype, "addEventListener");
    act(() => {
      const touchStart = document.createEvent("TouchEvent");
      touchStart.initEvent("touchstart");
      sinon.stub(touchStart, "target").get(() => ({}));
      sinon.stub(touchStart, "touches").get(() => [{}]);
      element.dispatchEvent(touchStart);
    });

    spy.notCalled.should.true;
  });

  it("should not remove target touch listeners", () => {
    const { result } = renderHook(() => usePointerCaptor(), { wrapper });
    const element = document.createElement("div");

    act(() => {
      result.current(element);
      fireEvent.touchStart(element, {
        touches: [{}],
      });
    });

    const spy = sandbox.spy(HTMLElement.prototype, "removeEventListener");
    act(() => {
      const touchEnd = document.createEvent("TouchEvent");
      touchEnd.initEvent("touchend");
      sinon.stub(touchEnd, "target").get(() => ({}));
      sinon.stub(touchEnd, "touches").get(() => [{}]);
      element.dispatchEvent(touchEnd);
    });

    spy.notCalled.should.true;
  });

  it("should call onPointerMove for document touchmove", () => {
    const spy = sinon.stub<NonNullable<Parameters<typeof usePointerCaptor>[1]>>();
    const { result } = renderHook(() => usePointerCaptor(undefined, spy), { wrapper });
    const element = document.createElement("div");
    act(() => {
      result.current(element);

      fireEvent.touchStart(element, {
        touches: [{}],
      });

      fireEvent.touchMove(document, {
        touches: [{}],
      });
    });

    spy.calledOnce.should.true;
  });

  it("should not handle document touchmove if it was dispatched for touch target", () => {
    const spy = sinon.stub<NonNullable<Parameters<typeof usePointerCaptor>[1]>>();
    const { result } = renderHook(() => usePointerCaptor(undefined, spy), { wrapper });
    const element = document.createElement("div");
    act(() => {
      result.current(element);

      fireEvent.touchStart(element, {
        touches: [{}],
      });

      const touchEnd = document.createEvent("TouchEvent");
      touchEnd.initEvent("touchmove");
      sinon.stub(touchEnd, "target").get(() => element);
      sinon.stub(touchEnd, "touches").get(() => [{}]);
      document.dispatchEvent(touchEnd);
    });

    spy.notCalled.should.true;
  });

  it("should not handle document touchend if it was dispatched for touch target", () => {
    const spy = sinon.stub<NonNullable<Parameters<typeof usePointerCaptor>[1]>>();
    const { result } = renderHook(() => usePointerCaptor(undefined, spy), { wrapper });
    const element = document.createElement("div");
    act(() => {
      result.current(element);

      fireEvent.touchStart(element, {
        touches: [{}],
      });

      const touchEnd = document.createEvent("TouchEvent");
      touchEnd.initEvent("touchend");
      sinon.stub(touchEnd, "target").get(() => element);
      sinon.stub(touchEnd, "touches").get(() => [{}]);
      document.dispatchEvent(touchEnd);
    });

    spy.notCalled.should.true;
  });
});
