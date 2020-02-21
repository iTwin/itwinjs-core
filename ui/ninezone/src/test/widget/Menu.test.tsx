/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { render } from "@testing-library/react";
import { WidgetMenu } from "../../ui-ninezone";
import { createDOMRect } from "../Utils";

describe("WidgetPanelWidgetMenu ", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should render", () => {
    const { container } = render(
      <WidgetMenu>
        <div>A</div>
        <div>B</div>
      </WidgetMenu>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render to right", () => {
    sandbox.stub(Element.prototype, "getBoundingClientRect").returns({
      ...createDOMRect(),
      left: 49,
    });
    sandbox.stub(document.body, "clientWidth").get(() => 100);
    const { container } = render(
      <WidgetMenu>
        <div>A</div>
        <div>B</div>
      </WidgetMenu>,
    );
    container.firstChild!.should.matchSnapshot();
  });
});
