/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { act, renderHook } from "@testing-library/react-hooks";
import { useTransientState, WidgetContentManagerContext, WidgetContentManagerContextArgs, TabState, TabIdContext } from "../../ui-ninezone";
import { EventEmitter } from "../../ui-ninezone/base/Event";

describe("useTransientState", () => {
  it("should invoke onSave", () => {
    const onSaveTransientState = new EventEmitter<(tabId: TabState["id"]) => void>();
    const widgetContentManager: WidgetContentManagerContextArgs = {
      getWidgetContentContainerRef: () => React.createRef(),
      onRestoreTransientState: new EventEmitter<(tabId: TabState["id"]) => void>(),
      onSaveTransientState,
    };
    const onSave = sinon.stub<NonNullable<Parameters<typeof useTransientState>[0]>>();
    renderHook(() => useTransientState(onSave), {
      wrapper: (props: { children?: React.ReactNode }) => <WidgetContentManagerContext.Provider value={widgetContentManager}>
        <TabIdContext.Provider value="t1">
          {props.children}
        </TabIdContext.Provider>
      </WidgetContentManagerContext.Provider>,
    });
    act(() => {
      onSaveTransientState.emit("t1");
    });
    onSave.calledOnceWithExactly().should.true;
  });

  it("should invoke onRestore", () => {
    const onRestoreTransientState = new EventEmitter<(tabId: TabState["id"]) => void>();
    const widgetContentManager: WidgetContentManagerContextArgs = {
      getWidgetContentContainerRef: () => React.createRef(),
      onRestoreTransientState,
      onSaveTransientState: new EventEmitter<(tabId: TabState["id"]) => void>(),
    };
    const onRestore = sinon.stub<NonNullable<Parameters<typeof useTransientState>[1]>>();
    renderHook(() => useTransientState(undefined, onRestore), {
      wrapper: (props: { children?: React.ReactNode }) => <WidgetContentManagerContext.Provider value={widgetContentManager}>
        <TabIdContext.Provider value="t1">
          {props.children}
        </TabIdContext.Provider>
      </WidgetContentManagerContext.Provider>,
    });
    act(() => {
      onRestoreTransientState.emit("t1");
    });
    onRestore.calledOnceWithExactly().should.true;
  });
});
