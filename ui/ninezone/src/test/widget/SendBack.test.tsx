/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { fireEvent, render } from "@testing-library/react";
import { ActiveTabIdContext, NineZoneDispatch, NineZoneDispatchContext, SendBack, WidgetIdContext } from "../../ui-ninezone";

describe("SendBack", () => {
  it("should render", () => {
    const { container } = render(
      <ActiveTabIdContext.Provider value="nz-tool-settings-tab">
        <WidgetIdContext.Provider value="w1">
          <SendBack />
        </WidgetIdContext.Provider>
      </ActiveTabIdContext.Provider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should dispatch WIDGET_SEND_BACK", () => {
    const dispatch = sinon.stub<NineZoneDispatch>();
    const { container } = render(
      <NineZoneDispatchContext.Provider value={dispatch}>
        <ActiveTabIdContext.Provider value="nz-tool-settings-tab">
          <WidgetIdContext.Provider value="w1">
            <SendBack />
          </WidgetIdContext.Provider>
        </ActiveTabIdContext.Provider>
      </NineZoneDispatchContext.Provider>,
    );
    const button = container.getElementsByClassName("nz-widget-sendBack")[0];
    fireEvent.click(button);

    dispatch.calledOnceWithExactly({
      type: "WIDGET_SEND_BACK",
      floatingWidgetId: undefined,
      side: undefined,
      widgetId: "w1",
    }).should.true;
  });
});
