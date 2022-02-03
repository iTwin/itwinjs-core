/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { render } from "@testing-library/react";
import { act, renderHook } from "@testing-library/react-hooks";
import type { TabState, WidgetContentManagerContextArgs} from "../../appui-layout-react";
import { EventEmitter, TabIdContext, useTransientState, WidgetContentManager, WidgetContentManagerContext, WidgetContentRenderer } from "../../appui-layout-react";

describe("WidgetContentRenderer", () => {
  const wrapper = WidgetContentManager;

  it("should remove existing content nodes before restoring", () => {
    const renderTo = document.createElement("div");
    renderTo.appendChild(document.createElement("div"));

    const spy = sinon.spy(renderTo, "removeChild");
    render(<WidgetContentRenderer
      renderTo={renderTo}
      tabId="t1"
    />, { wrapper });

    spy.callCount.should.eq(1);
  });

  it("should remove added content node", () => {
    const renderTo = document.createElement("div");

    const spy = sinon.spy(renderTo, "removeChild");
    const { unmount } = render(<WidgetContentRenderer
      renderTo={renderTo}
      tabId="t1"
    />, { wrapper });

    renderTo.insertBefore(document.createElement("div"), renderTo.firstChild);
    renderTo.appendChild(document.createElement("div"));
    unmount();

    spy.callCount.should.eq(1);
  });
});

describe("useTransientState", () => {
  it("should invoke onSave", () => {
    const onSaveTransientState = new EventEmitter<(tabId: TabState["id"]) => void>();
    const widgetContentManager: WidgetContentManagerContextArgs = {
      setContainer: () => { },
      onRestoreTransientState: new EventEmitter<(tabId: TabState["id"]) => void>(),
      onSaveTransientState,
    };
    const onSave = sinon.stub<NonNullable<Parameters<typeof useTransientState>[0]>>();
    renderHook(() => useTransientState(onSave), {
      // eslint-disable-next-line react/display-name
      wrapper: (props: { children?: React.ReactNode }) => <WidgetContentManagerContext.Provider value={widgetContentManager}>
        <TabIdContext.Provider value="t1">
          {props.children}
        </TabIdContext.Provider>
      </WidgetContentManagerContext.Provider>,
    });
    act(() => { // eslint-disable-line @typescript-eslint/no-floating-promises
      onSaveTransientState.emit("t1");
    });
    onSave.calledOnceWithExactly().should.true;
  });

  it("should invoke onRestore", () => {
    const onRestoreTransientState = new EventEmitter<(tabId: TabState["id"]) => void>();
    const widgetContentManager: WidgetContentManagerContextArgs = {
      setContainer: () => { },
      onRestoreTransientState,
      onSaveTransientState: new EventEmitter<(tabId: TabState["id"]) => void>(),
    };
    const onRestore = sinon.stub<NonNullable<Parameters<typeof useTransientState>[1]>>();
    renderHook(() => useTransientState(undefined, onRestore), {
      // eslint-disable-next-line react/display-name
      wrapper: (props: { children?: React.ReactNode }) => <WidgetContentManagerContext.Provider value={widgetContentManager}>
        <TabIdContext.Provider value="t1">
          {props.children}
        </TabIdContext.Provider>
      </WidgetContentManagerContext.Provider>,
    });
    act(() => { // eslint-disable-line @typescript-eslint/no-floating-promises
      onRestoreTransientState.emit("t1");
    });
    onRestore.calledOnceWithExactly().should.true;
  });
});
