/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { render } from "@testing-library/react";
import { WidgetMenu } from "../../appui-layout-react";

describe("WidgetMenu ", () => {
  it("should render", () => {
    render(
      <WidgetMenu
        open
      >
        <div>A</div>
        <div>B</div>
      </WidgetMenu>,
    );
    const menu = document.getElementsByClassName("nz-widget-menu")[0];
    menu.should.matchSnapshot();
  });

  it("should render to right", () => {
    sinon.stub(Element.prototype, "getBoundingClientRect").returns({
      ...new DOMRect(),
      left: 49,
    });
    sinon.stub(document.body, "clientWidth").get(() => 100);
    render(
      <WidgetMenu
        open
      >
        <div>A</div>
        <div>B</div>
      </WidgetMenu>,
    );
    const menu = document.getElementsByClassName("nz-widget-menu")[0];
    menu.should.matchSnapshot();
  });

  it("should render to bottom", () => {
    sinon.stub(Element.prototype, "getBoundingClientRect").returns({
      ...new DOMRect(),
      top: 49,
    });
    sinon.stub(document.body, "clientHeight").get(() => 100);
    render(
      <WidgetMenu
        open
      >
        <div>A</div>
        <div>B</div>
      </WidgetMenu>,
    );
    const menu = document.getElementsByClassName("nz-widget-menu")[0];
    menu.should.matchSnapshot();
  });
});
