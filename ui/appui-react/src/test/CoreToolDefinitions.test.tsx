/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { ToolbarWithOverflow } from "@itwin/components-react";
import { Direction, Toolbar } from "@itwin/appui-layout-react";
import { ActionItemButton, CoreTools, FrontstageManager, ToolWidget, ToolWidgetComposer } from "../appui-react";
import { ToolbarHelper } from "../appui-react/toolbar/ToolbarHelper";
import TestUtils, { mount } from "./TestUtils";

describe("CoreToolDefinitions", () => {

  let horizontalToolbar: React.ReactNode;
  let horizontalToolbarWithOverflow: React.ReactNode;

  before(async () => {
    await TestUtils.initializeUiFramework();
    FrontstageManager.clearFrontstageProviders();
    await FrontstageManager.setActiveFrontstageDef(undefined);

    // Set in the before() after UiFramework.i18n is initialized
    horizontalToolbar =
      <Toolbar // eslint-disable-line deprecation/deprecation
        expandsTo={Direction.Bottom} // eslint-disable-line deprecation/deprecation
        items={
          <>
            {/* eslint-disable-next-line deprecation/deprecation */}
            <ActionItemButton actionItem={CoreTools.selectElementCommand} />
            {/* eslint-disable-next-line deprecation/deprecation */}
            <ActionItemButton actionItem={CoreTools.fitViewCommand} />
            {/* eslint-disable-next-line deprecation/deprecation */}
            <ActionItemButton actionItem={CoreTools.windowAreaCommand} />
            {/* eslint-disable-next-line deprecation/deprecation */}
            <ActionItemButton actionItem={CoreTools.zoomViewCommand} />
            {/* eslint-disable-next-line deprecation/deprecation */}
            <ActionItemButton actionItem={CoreTools.panViewCommand} />
            {/* eslint-disable-next-line deprecation/deprecation */}
            <ActionItemButton actionItem={CoreTools.rotateViewCommand} />
            {/* eslint-disable-next-line deprecation/deprecation */}
            <ActionItemButton actionItem={CoreTools.walkViewCommand} />
            {/* eslint-disable-next-line deprecation/deprecation */}
            <ActionItemButton actionItem={CoreTools.toggleCameraViewCommand} />
            {/* eslint-disable-next-line deprecation/deprecation */}
            <ActionItemButton actionItem={CoreTools.flyViewCommand} />
            {/* eslint-disable-next-line deprecation/deprecation */}
            <ActionItemButton actionItem={CoreTools.sectionByPlaneCommandItemDef} />
            {/* eslint-disable-next-line deprecation/deprecation */}
            <ActionItemButton actionItem={CoreTools.sectionByElementCommandItemDef} />
            {/* eslint-disable-next-line deprecation/deprecation */}
            <ActionItemButton actionItem={CoreTools.sectionByShapeCommandItemDef} />
            {/* eslint-disable-next-line deprecation/deprecation */}
            <ActionItemButton actionItem={CoreTools.sectionByRangeCommandItemDef} />
          </>
        }
      />;

    // Set in the before() after UiFramework.i18n is initialized
    horizontalToolbarWithOverflow =
      <ToolbarWithOverflow
        expandsTo={Direction.Bottom} // eslint-disable-line deprecation/deprecation
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
    mount(
      <ToolWidget // eslint-disable-line deprecation/deprecation
        horizontalToolbar={horizontalToolbar}
      />,
    );
  });

  it("ToolWidget should render correctly with Core Tool Definitions", () => {
    shallow(
      <ToolWidget // eslint-disable-line deprecation/deprecation
        id="toolWidget"
        horizontalToolbar={horizontalToolbar}
      />,
    ).should.matchSnapshot();
  });

  it("ToolWidgetComposer should render with Core Tool Definitions", () => {
    mount(
      <ToolWidgetComposer // eslint-disable-line deprecation/deprecation
        horizontalToolbar={horizontalToolbarWithOverflow}
      />,
    );
  });

  it("ToolWidgetComposer should render correctly with Core Tool Definitions", () => {
    shallow(
      <ToolWidgetComposer // eslint-disable-line deprecation/deprecation
        horizontalToolbar={horizontalToolbarWithOverflow}
      />,
    ).should.matchSnapshot();
  });

});
