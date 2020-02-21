/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render } from "@testing-library/react";
import { WidgetPanelContent } from "../../ui-ninezone";

describe("WidgetPanelContent", () => {
  it("should render", () => {
    const { container } = render(
      <WidgetPanelContent />,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render pinned left", () => {
    const { container } = render(
      <WidgetPanelContent
        pinnedLeft
      />,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render pinned right", () => {
    const { container } = render(
      <WidgetPanelContent
        pinnedRight
      />,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render pinned top", () => {
    const { container } = render(
      <WidgetPanelContent
        pinnedTop
      />,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render pinned bottom", () => {
    const { container } = render(
      <WidgetPanelContent
        pinnedBottom
      />,
    );
    container.firstChild!.should.matchSnapshot();
  });
});
