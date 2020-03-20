/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { act, render } from "@testing-library/react";
import { WidgetContentManagerContext, TabState, TabIdContext, ScrollableWidgetContent } from "../../ui-ninezone";
import { EventEmitter } from "../../ui-ninezone/base/Event";

describe("ScrollableWidgetContent", () => {
  it("should save and restore scroll position", () => {
    const onSaveTransientState = new EventEmitter<(tabId: TabState["id"]) => void>();
    const onRestoreTransientState = new EventEmitter<(tabId: TabState["id"]) => void>();
    const { container } = render(<WidgetContentManagerContext.Provider value={{
      getWidgetContentContainerRef: () => React.createRef(),
      onRestoreTransientState,
      onSaveTransientState,
    }}>
      <TabIdContext.Provider value="t1">
        <ScrollableWidgetContent />
      </TabIdContext.Provider>
    </WidgetContentManagerContext.Provider>,
    );

    const content = container.getElementsByClassName("nz-widget-content")[0];
    const scrollLeftSpy = sinon.spy(content, "scrollLeft", ["get", "set"]);
    act(() => {
      onSaveTransientState.emit("t1");
      onRestoreTransientState.emit("t1");
    });
    scrollLeftSpy.get.callCount.should.eq(1);
    scrollLeftSpy.set.callCount.should.eq(1);
  });
});
