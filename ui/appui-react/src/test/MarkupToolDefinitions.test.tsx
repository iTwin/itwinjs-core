/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { MarkupApp } from "@itwin/core-markup";
import { Direction, Toolbar } from "@itwin/appui-layout-react";
import { ActionItemButton, MarkupTools, ToolWidget, UiFramework } from "../appui-react";
import TestUtils, { mount } from "./TestUtils";

/* eslint-disable deprecation/deprecation */

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

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("ToolWidget should render with Markup Tool Definitions", () => {
    mount(
      <ToolWidget
        horizontalToolbar={horizontalToolbar}
      />,
    );
  });

  it("ToolWidget should render correctly with Markup Tool Definitions", async () => {
    UiFramework.frontstages.clearFrontstageProviders();
    await UiFramework.frontstages.setActiveFrontstageDef(undefined);
    setImmediate(async () => {
      await TestUtils.flushAsyncOperations();
      shallow(
        <ToolWidget
          id="toolWidget"
          horizontalToolbar={horizontalToolbar}
        />,
      ).should.matchSnapshot();
    });
  });

});
