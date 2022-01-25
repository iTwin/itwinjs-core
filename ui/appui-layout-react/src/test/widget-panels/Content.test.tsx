/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render } from "@testing-library/react";
import { WidgetPanelsContent } from "../../appui-layout-react";

describe("WidgetPanelsContent", () => {
  it("should render", () => {
    const { container } = render(
      <WidgetPanelsContent />,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render pinned left", () => {
    const { container } = render(
      <WidgetPanelsContent
        pinnedLeft
      />,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render pinned right", () => {
    const { container } = render(
      <WidgetPanelsContent
        pinnedRight
      />,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render pinned top", () => {
    const { container } = render(
      <WidgetPanelsContent
        pinnedTop
      />,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should render pinned bottom", () => {
    const { container } = render(
      <WidgetPanelsContent
        pinnedBottom
      />,
    );
    container.firstChild!.should.matchSnapshot();
  });
});
