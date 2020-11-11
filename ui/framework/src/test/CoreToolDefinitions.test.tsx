/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { ToolbarWithOverflow } from "@bentley/ui-components";
import { Direction, Toolbar } from "@bentley/ui-ninezone";
import { ActionItemButton, CoreTools, ToolWidget, ToolWidgetComposer } from "../ui-framework";
import { ToolbarHelper } from "../ui-framework/toolbar/ToolbarHelper";
import TestUtils, { mount } from "./TestUtils";

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
