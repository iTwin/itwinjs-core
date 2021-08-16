/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { renderHook } from "@testing-library/react-hooks";
import * as sinon from "sinon";
import { useEventListener } from "../../../ui-core/utils/hooks/useEventListener";

describe("useEventListener", () => {

  it("should handle event on Window", () => {
    const mouseClickEvent = new MouseEvent("click", { bubbles: true });

    const handler = sinon.spy();
    const addEventListenerSpy = sinon.spy(document, "addEventListener");
    renderHook(() => useEventListener("click", handler, document));
    expect(addEventListenerSpy).to.be.called;
    document.dispatchEvent(mouseClickEvent);
    expect(handler).to.be.calledWith(mouseClickEvent);
    addEventListenerSpy.restore();
  });

  it("should handle event on Element", () => {
    const element: HTMLDivElement = document.createElement("div");
    const mouseClickEvent = new MouseEvent("click", { bubbles: true });
    const handler = sinon.spy();
    const addEventListenerSpy = sinon.spy(element, "addEventListener");
    renderHook(() => useEventListener("click", handler, element));
    expect(addEventListenerSpy).to.be.called;
    element.dispatchEvent(mouseClickEvent);
    expect(handler).to.be.calledWith(mouseClickEvent);
    addEventListenerSpy.restore();
  });

  it("should not re-add listener when handler is changed", () => {
    const element: HTMLDivElement = document.createElement("div");
    const handler1 = sinon.spy();
    const handler2 = sinon.spy();
    const addEventListenerSpy = sinon.spy(element, "addEventListener");
    const { rerender } = renderHook(() =>
      useEventListener("click", handler1, element),
    );
    const numberOfCalls = addEventListenerSpy.callCount;
    rerender(() => {
      useEventListener("click", handler2, element);
    });
    expect(addEventListenerSpy.callCount).to.be.equal(numberOfCalls);
    addEventListenerSpy.restore();
  });

  it("should do nothing if no element or document is defined", () => {
    const handler = sinon.spy();
    const addEventListenerSpy = sinon.spy(document, "addEventListener");
    renderHook(() => useEventListener("click", handler, undefined));
    expect(addEventListenerSpy).not.to.be.called;
    expect(handler).not.to.be.called;
    addEventListenerSpy.restore();
  });
});
