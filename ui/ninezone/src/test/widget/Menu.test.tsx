/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import tlr from "@testing-library/react"; const { render } = tlr;
import { WidgetMenu } from "../../ui-ninezone.js";
import { createDOMRect } from "../Utils.js";

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
      ...createDOMRect(),
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
      ...createDOMRect(),
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
