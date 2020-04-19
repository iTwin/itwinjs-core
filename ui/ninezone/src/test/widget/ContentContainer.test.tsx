/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render } from "@testing-library/react";
import { WidgetContentContainer, WidgetContentManagerContextArgs, TabState, EventEmitter, WidgetStateContext } from "../../ui-ninezone";
import { createWidgetState } from "../../ui-ninezone/base/NineZoneState";
import { WidgetContentManagerContext } from "../../ui-ninezone/widget/ContentManager";

describe("WidgetContentContainer ", () => {
  it("should render minimized", () => {
    const onSaveTransientState = new EventEmitter<(tabId: TabState["id"]) => void>();
    const widgetContentManager: WidgetContentManagerContextArgs = {
      getWidgetContentContainerRef: () => React.createRef(),
      onRestoreTransientState: new EventEmitter<(tabId: TabState["id"]) => void>(),
      onSaveTransientState,
    };
    const { container } = render(
      <WidgetContentManagerContext.Provider value={widgetContentManager}>
        <WidgetStateContext.Provider value={createWidgetState("w1", { activeTabId: "t1", minimized: true })}>
          <WidgetContentContainer />
        </WidgetStateContext.Provider>
      </WidgetContentManagerContext.Provider>,
    );
    container.firstChild!.should.matchSnapshot();
  });
});
