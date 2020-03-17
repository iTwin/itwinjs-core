/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { renderHook } from "@testing-library/react-hooks";
import { useTabTarget, DragManagerContext } from "../../ui-ninezone";
import { DragManager, usePanelTarget, useWidgetTarget } from "../../ui-ninezone/base/DragManager";

describe("useTabTarget", () => {
  it("should clear target", () => {
    const dragManager = new DragManager();
    const spy = sinon.spy(dragManager, "handleTargetChanged");
    const { result } = renderHook(() => useTabTarget({
      tabIndex: 0,
      widgetId: "w1",
    }), {
      wrapper: (props) => <DragManagerContext.Provider value={dragManager} {...props} />,
    });
    result.current(false);
    spy.calledOnceWithExactly(undefined).should.true;
  });
});

describe("usePanelTarget", () => {
  it("should clear target", () => {
    const dragManager = new DragManager();
    const spy = sinon.spy(dragManager, "handleTargetChanged");
    const { result } = renderHook(() => usePanelTarget({
      side: "left",
    }), {
      wrapper: (props) => <DragManagerContext.Provider value={dragManager} {...props} />,
    });
    result.current(false);
    spy.calledOnceWithExactly(undefined).should.true;
  });
});

describe("useWidgetTarget", () => {
  it("should clear target", () => {
    const dragManager = new DragManager();
    const spy = sinon.spy(dragManager, "handleTargetChanged");
    const { result } = renderHook(() => useWidgetTarget({
      side: "left",
      widgetIndex: 0,
    }), {
      wrapper: (props) => <DragManagerContext.Provider value={dragManager} {...props} />,
    });
    result.current(false);
    spy.calledOnceWithExactly(undefined).should.true;
  });
});
