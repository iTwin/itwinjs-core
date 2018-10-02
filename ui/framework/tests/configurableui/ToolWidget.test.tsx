/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
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
  ConfigurableUIManager,
  ItemPropsList,
  ToolButton,
  GroupButton,
  ToolWidget,
} from "../../src/index";
import Toolbar from "@bentley/ui-ninezone/lib/toolbar/Toolbar";
import Direction from "@bentley/ui-ninezone/lib/utilities/Direction";

describe("ToolWidget", () => {

  const testCallback = sinon.stub();

  before(async () => {
    await TestUtils.initializeUiFramework();

    const commonItemsList: ItemPropsList = {
      items: [
        {
          toolId: "SampleApp.BackstageToggle",
          iconClass: "icon-home",
          execute: testCallback,
        },
        {
          toolId: "tool1",
          iconClass: "icon-placeholder",
        },
        {
          toolId: "tool2",
          iconClass: "icon-placeholder",
        },
      ],
    };

    ConfigurableUIManager.loadCommonItems(commonItemsList);
  });

  const widgetProps: AnyWidgetProps = {
    classId: "ToolWidget",
    defaultState: WidgetState.Open,
    isFreeform: true,
    iconClass: "icon-home",
    labelKey: "SampleApp:Test.my-label",
    appButtonId: "SampleApp.BackstageToggle",
    horizontalIds: ["tool1"],
    verticalIds: ["tool2"],
    horizontalDirection: Direction.Top,
    verticalDirection: Direction.Left,
  };

  it("ToolWidgetDef from WidgetProps", () => {

    const widgetDef = WidgetDefFactory.create(widgetProps);
    expect(widgetDef).to.be.instanceof(ToolWidgetDef);

    const toolWidgetDef = widgetDef as ToolWidgetDef;
    toolWidgetDef.executeAppButtonClick();
    expect(testCallback.calledOnce).to.be.true;

    const reactElement = toolWidgetDef.reactElement;
    expect(reactElement).to.not.be.undefined;

    const reactNode = toolWidgetDef.renderCornerItem();
    expect(reactNode).to.not.be.undefined;
  });

  it("ToolWidget should mount with Ids", () => {
    const wrapper = mount(
      <ToolWidget
        appButtonId="SampleApp.BackstageToggle"
        horizontalIds={widgetProps.horizontalIds}
        verticalIds={widgetProps.verticalIds}
      />,
    );
    wrapper.unmount();
  });

  const horizontalToolbar =
    <Toolbar
      expandsTo={Direction.Bottom}
      items={
        <>
          <ToolButton toolId="tool1" iconClass="icon-placeholder" labelKey="SampleApp:buttons.tool1" />
          <ToolButton toolId="tool2" iconClass="icon-placeholder" labelKey="SampleApp:buttons.tool2" />
          <GroupButton
            labelKey="SampleApp:buttons.toolGroup"
            iconClass="icon-placeholder"
            items={["tool1", "tool2", "item3", "item4", "item5", "item6", "item7", "item8", "tool1", "tool2", "item3", "item4", "item5", "item6", "item7", "item8"]}
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
          <ToolButton toolId="tool1" iconClass="icon-placeholder" labelKey="SampleApp:buttons.tool1" />
          <ToolButton toolId="tool2" iconClass="icon-placeholder" labelKey="SampleApp:buttons.tool2" />
          <GroupButton
            labelKey="SampleApp:buttons.anotherGroup"
            iconClass="icon-placeholder"
            items={["tool1", "tool2", "item3", "item4", "item5", "item6", "item7", "item8"]}
          />
        </>
      }
    />;

  it("ToolWidget should render", () => {
    const wrapper = mount(
      <ToolWidget
        appButtonId="SampleApp.BackstageToggle"
        horizontalToolbar={horizontalToolbar}
        verticalToolbar={verticalToolbar}
      />,
    );
    wrapper.unmount();
  });

  it("ToolWidget should render correctly", () => {
    shallow(
      <ToolWidget
        appButtonId="SampleApp.BackstageToggle"
        horizontalToolbar={horizontalToolbar}
        verticalToolbar={verticalToolbar}
      />,
    ).should.matchSnapshot();
  });

});
