/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render } from "@testing-library/react";
import { ActiveTabIdContext, createFloatingWidgetState, FloatingWidgetContext, FloatingWidgetIdContext, TabBarButtons, toolSettingsTabId } from "../../ui-ninezone";

describe("TabBarButtons", () => {
  it("should render SendBack button", () => {
    const { container } = render(
      <FloatingWidgetIdContext.Provider value="w1">
        <FloatingWidgetContext.Provider value={createFloatingWidgetState("w1")}>
          <TabBarButtons />
        </FloatingWidgetContext.Provider>
      </FloatingWidgetIdContext.Provider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render Dock button", () => {
    const { container } = render(
      <ActiveTabIdContext.Provider value={toolSettingsTabId}>
        <TabBarButtons />
      </ActiveTabIdContext.Provider>,
    );
    container.firstChild!.should.matchSnapshot();
  });
});
