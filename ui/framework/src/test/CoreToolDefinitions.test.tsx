/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import TestUtils from "./TestUtils";
import {
  ToolWidget,
  ActionItemButton,
  CoreTools,
  ToolWidgetComposer,
} from "../ui-framework";
import { Direction, Toolbar } from "@bentley/ui-ninezone";
import { ToolbarWithOverflow } from "@bentley/ui-components";
import { ToolbarHelper } from "../ui-framework/toolbar/ToolbarHelper";

describe("CoreToolDefinitions", () => {

  let horizontalToolbar: React.ReactNode;
  let horizontalToolbarWithOverflow: React.ReactNode;

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

    // Set in the before() after UiFramework.i18n is initialized
    horizontalToolbarWithOverflow =
      <ToolbarWithOverflow
        expandsTo={Direction.Bottom}
        items={ToolbarHelper.createToolbarItemsFromItemDefs([
          CoreTools.keyinBrowserButtonItemDef,
          CoreTools.selectElementCommand,
          CoreTools.fitViewCommand,
          CoreTools.windowAreaCommand,
          CoreTools.zoomViewCommand,
          CoreTools.panViewCommand,
          CoreTools.rotateViewCommand,
          CoreTools.walkViewCommand,
          CoreTools.toggleCameraViewCommand,
          CoreTools.flyViewCommand,
          CoreTools.sectionByPlaneCommandItemDef,
          CoreTools.sectionByElementCommandItemDef,
          CoreTools.sectionByShapeCommandItemDef,
          CoreTools.sectionByRangeCommandItemDef,
        ])}
      />;
  });

  it("ToolWidget should render with Core Tool Definitions", () => {
    const wrapper = mount(
      <ToolWidget // tslint:disable-line:deprecation
        horizontalToolbar={horizontalToolbar}
      />,
    );
    wrapper.unmount();
  });

  it("ToolWidget should render correctly with Core Tool Definitions", () => {
    shallow(
      <ToolWidget // tslint:disable-line:deprecation
        id="toolWidget"
        horizontalToolbar={horizontalToolbar}
      />,
    ).should.matchSnapshot();
  });

  it("ToolWidgetComposer should render with Core Tool Definitions", () => {
    const wrapper = mount(
      <ToolWidgetComposer // tslint:disable-line:deprecation
        horizontalToolbar={horizontalToolbarWithOverflow}
      />,
    );
    wrapper.unmount();
  });

  it("ToolWidgetComposer should render correctly with Core Tool Definitions", () => {
    shallow(
      <ToolWidgetComposer // tslint:disable-line:deprecation
        horizontalToolbar={horizontalToolbarWithOverflow}
      />,
    ).should.matchSnapshot();
  });

});
