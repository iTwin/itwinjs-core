/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { act, fireEvent, render } from "@testing-library/react";
import { WidgetOverflow } from "../../ui-ninezone";

describe("WidgetOverflow", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should render", () => {
    const { container } = render(
      <WidgetOverflow>
        <div>A</div>
        <div>B</div>
      </WidgetOverflow>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should open panel", () => {
    const { container } = render(
      <WidgetOverflow className="nzdemo-overflow">
        <div>A</div>
        <div>B</div>
      </WidgetOverflow>,
    );
    const button = container.getElementsByClassName("nz-button")[0];
    act(() => {
      fireEvent.click(button);
    });
    container.firstChild!.should.matchSnapshot();
  });

  it("should close panel on outside click", () => {
    const { container } = render(
      <WidgetOverflow className="nzdemo-overflow">
        <div>A</div>
        <div>B</div>
      </WidgetOverflow>,
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
