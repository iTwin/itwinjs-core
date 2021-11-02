/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { act, fireEvent, render } from "@testing-library/react";
import { WidgetOverflow, WidgetTabsEntryContext } from "../../appui-layout-react";

describe("WidgetOverflow", () => {
  it("should render", () => {
    const { container } = render(
      <WidgetTabsEntryContext.Provider value={{
        lastNotOverflown: false,
        onResize: () => { },
      }}>
        <WidgetOverflow>
          <div>A</div>
          <div>B</div>
        </WidgetOverflow>
      </WidgetTabsEntryContext.Provider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should open panel", () => {
    const { container } = render(
      <WidgetTabsEntryContext.Provider value={{
        lastNotOverflown: false,
        onResize: () => { },
      }}>
        <WidgetOverflow>
          <div>A</div>
          <div>B</div>
        </WidgetOverflow>
      </WidgetTabsEntryContext.Provider>,
    );
    const button = container.getElementsByClassName("nz-button")[0];
    act(() => {
      fireEvent.click(button);
    });
    const menu = document.getElementsByClassName("nz-widget-menu")[0];
    menu.should.matchSnapshot();
  });

  it("should close panel on outside click", () => {
    const { container } = render(
      <WidgetTabsEntryContext.Provider value={{
        lastNotOverflown: false,
        onResize: () => { },
      }}>
        <WidgetOverflow>
          <div>A</div>
          <div>B</div>
        </WidgetOverflow>
      </WidgetTabsEntryContext.Provider>,
    );
    const button = container.getElementsByClassName("nz-button")[0];
    act(() => {
      fireEvent.click(button);
    });
    document.getElementsByClassName("nz-widget-menu").length.should.eq(1);

    act(() => {
      fireEvent.pointerDown(document);
      fireEvent.pointerUp(document);
    });

    document.getElementsByClassName("nz-widget-menu").length.should.eq(0);
  });
});
