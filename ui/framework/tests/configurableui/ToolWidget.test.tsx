/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import * as sinon from "sinon";
import { mount, shallow } from "enzyme";
import TestUtils from "../TestUtils";
import {
  AnyWidgetProps,
  WidgetState,
  WidgetDefFactory,
  ToolWidgetDef,
  ToolButton,
  GroupButton,
  ToolWidget,
  CommandItemDef,
} from "../../src/index";
import Toolbar from "@bentley/ui-ninezone/lib/toolbar/Toolbar";
import Direction from "@bentley/ui-ninezone/lib/utilities/Direction";

describe("ToolWidget", () => {

  const testCallback = sinon.stub();

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  const backstageToggleCommand =
    new CommandItemDef({
      commandId: "SampleApp.BackstageToggle",
      iconSpec: "icon-home",
      execute: testCallback,
    });

  const tool1 = new CommandItemDef({
    commandId: "tool1",
    iconSpec: "icon-placeholder",
  });

  const tool2 = new CommandItemDef({
    commandId: "tool2",
    iconSpec: "icon-placeholder",
    applicationData: { key: "value" },
  });

  const widgetProps: AnyWidgetProps = {
    classId: "ToolWidget",
    defaultState: WidgetState.Open,
    isFreeform: true,
    iconSpec: "icon-home",
    appButton: backstageToggleCommand,
    horizontalDirection: Direction.Top,
    verticalDirection: Direction.Left,
  };

  it("ToolWidgetDef from WidgetProps", () => {

    const widgetDef = WidgetDefFactory.create(widgetProps);
    expect(widgetDef).to.be.instanceof(ToolWidgetDef);

    const toolWidgetDef = widgetDef as ToolWidgetDef;
    backstageToggleCommand.execute();
    expect(testCallback.calledOnce).to.be.true;

    const reactElement = toolWidgetDef.reactElement;
    expect(reactElement).to.not.be.undefined;

    const reactNode = toolWidgetDef.renderCornerItem();
    expect(reactNode).to.not.be.undefined;
  });

  const horizontalToolbar =
    <Toolbar
      expandsTo={Direction.Bottom}
      items={
        <>
          <ToolButton toolId="tool1" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.tool1" />
          <ToolButton toolId="tool2" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.tool2" />
          <GroupButton
            iconSpec="icon-placeholder"
            items={[tool1, tool2]}
            direction={Direction.Bottom}
            itemsInColumn={7}
          />
        </>
      }
    />;

  const verticalToolbar =
    <Toolbar
      expandsTo={Direction.Right}
      items={
        <>
          <ToolButton toolId="tool1" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.tool1" />
          <ToolButton toolId="tool2" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.tool2" />
          <GroupButton
            iconSpec="icon-placeholder"
            items={[tool1, tool2]}
          />
        </>
      }
    />;

  it("ToolWidget should render", () => {
    const wrapper = mount(
      <ToolWidget
        appButton={backstageToggleCommand}
        horizontalToolbar={horizontalToolbar}
        verticalToolbar={verticalToolbar}
      />,
    );
    wrapper.unmount();
  });

  it("ToolWidget should render correctly", () => {
    shallow(
      <ToolWidget
        id="toolWidget"
        appButton={backstageToggleCommand}
        horizontalToolbar={horizontalToolbar}
        verticalToolbar={verticalToolbar}
      />,
    ).should.matchSnapshot();
  });

});
