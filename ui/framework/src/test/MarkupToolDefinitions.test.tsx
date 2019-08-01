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
  MarkupTools,
} from "../ui-framework";
import { Direction, Toolbar } from "@bentley/ui-ninezone";
import { MarkupApp } from "@bentley/imodeljs-markup";

describe("MarkupToolDefinitions", () => {

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
            <ActionItemButton actionItem={MarkupTools.selectToolDef} />
            <ActionItemButton actionItem={MarkupTools.lineToolDef} />
            <ActionItemButton actionItem={MarkupTools.rectangleToolDef} />
            <ActionItemButton actionItem={MarkupTools.polygonToolDef} />
            <ActionItemButton actionItem={MarkupTools.cloudToolDef} />
            <ActionItemButton actionItem={MarkupTools.ellipseToolDef} />
            <ActionItemButton actionItem={MarkupTools.arrowToolDef} />
            <ActionItemButton actionItem={MarkupTools.distanceToolDef} />
            <ActionItemButton actionItem={MarkupTools.sketchToolDef} />
            <ActionItemButton actionItem={MarkupTools.placeTextToolDef} />
            <ActionItemButton actionItem={MarkupTools.symbolToolDef} />
          </>
        }
      />;
  });

  it("ToolWidget should render with Markup Tool Definitions", () => {
    const wrapper = mount(
      <ToolWidget
        horizontalToolbar={horizontalToolbar}
      />,
    );
    wrapper.unmount();
  });

  it("ToolWidget should render correctly with Markup Tool Definitions", () => {
    shallow(
      <ToolWidget
        id="toolWidget"
        horizontalToolbar={horizontalToolbar}
      />,
    ).should.matchSnapshot();
  });

});
