/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
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
import { Direction, Toolbar, Item } from "@bentley/ui-ninezone";
import { MarkupApp } from "@bentley/imodeljs-markup";

describe("CoreToolDefinitions", () => {

  let horizontalToolbar: React.ReactNode;

  before(async () => {
    await TestUtils.initializeUiFramework();
    await MarkupApp.initialize();

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
            <ActionItemButton actionItem={CoreTools.sectionByPlaneCommand} />

            <ActionItemButton actionItem={CoreTools.markupSelectToolDef} />
            <ActionItemButton actionItem={CoreTools.markupLineToolDef} />
            <ActionItemButton actionItem={CoreTools.markupRectangleToolDef} />
            <ActionItemButton actionItem={CoreTools.markupPolygonToolDef} />
            <ActionItemButton actionItem={CoreTools.markupCloudToolDef} />
            <ActionItemButton actionItem={CoreTools.markupEllipseToolDef} />
            <ActionItemButton actionItem={CoreTools.markupArrowToolDef} />
            <ActionItemButton actionItem={CoreTools.markupDistanceToolDef} />
            <ActionItemButton actionItem={CoreTools.markupSketchToolDef} />
            <ActionItemButton actionItem={CoreTools.markupPlaceTextToolDef} />
            <ActionItemButton actionItem={CoreTools.markupSymbolToolDef} />
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
    const sut = shallow(CoreTools.keyinBrowserButtonItemDef.reactElement as React.ReactElement);
    const nzItem = sut.find(Item);
    nzItem.simulate("click"); // opens the panel
    sut.should.matchSnapshot();
  });
});
