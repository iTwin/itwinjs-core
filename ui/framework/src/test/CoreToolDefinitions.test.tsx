/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import TestUtils from "./TestUtils";
import {
  ToolWidget,
  ActionItemButton,
  CoreTools,
} from "../ui-framework";
import { Direction, Toolbar } from "@bentley/ui-ninezone";
import { PopupButton } from "../ui-framework/toolbar/PopupButton";

describe("CoreToolDefinitions", () => {

  let horizontalToolbar: React.ReactNode;

  before(async () => {
    await TestUtils.initializeUiFramework();

    // Set in the before() after UiFramework.i18n is initialized
    horizontalToolbar =
      <Toolbar
        expandsTo={Direction.Bottom}
        items={
          <>
            <ActionItemButton actionItem={CoreTools.selectElementCommand} />
            <ActionItemButton actionItem={CoreTools.fitViewCommand} />
            <ActionItemButton actionItem={CoreTools.windowAreaCommand} />
            <ActionItemButton actionItem={CoreTools.zoomViewCommand} />
            <ActionItemButton actionItem={CoreTools.panViewCommand} />
            <ActionItemButton actionItem={CoreTools.rotateViewCommand} />
            <ActionItemButton actionItem={CoreTools.walkViewCommand} />
            <ActionItemButton actionItem={CoreTools.toggleCameraViewCommand} />
            <ActionItemButton actionItem={CoreTools.flyViewCommand} />
            <ActionItemButton actionItem={CoreTools.sectionByPlaneCommandItemDef} />
            <ActionItemButton actionItem={CoreTools.sectionByElementCommandItemDef} />
            <ActionItemButton actionItem={CoreTools.sectionByShapeCommandItemDef} />
            <ActionItemButton actionItem={CoreTools.sectionByRangeCommandItemDef} />
          </>
        }
      />;
  });

  it("ToolWidget should render with Core Tool Definitions", () => {
    const wrapper = mount(
      <ToolWidget
        horizontalToolbar={horizontalToolbar}
      />,
    );
    wrapper.unmount();
  });

  it("ToolWidget should render correctly with Core Tool Definitions", () => {
    shallow(
      <ToolWidget
        id="toolWidget"
        horizontalToolbar={horizontalToolbar}
      />,
    ).should.matchSnapshot();
  });

  it("should render KeyInBrowser", () => {
    const sut = shallow<PopupButton>(CoreTools.keyinBrowserButtonItemDef.reactElement as React.ReactElement);
    sut.setState({ isPressed: true });
    sut.dive().should.matchSnapshot();
  });
});
