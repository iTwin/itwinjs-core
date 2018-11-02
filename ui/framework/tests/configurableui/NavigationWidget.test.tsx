/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import { mount, shallow } from "enzyme";
import TestUtils from "../TestUtils";
import {
  AnyWidgetProps,
  WidgetState,
  WidgetDefFactory,
  NavigationWidgetDef,
  ToolButton,
  NavigationWidget,
} from "../../src/index";
import Toolbar from "@bentley/ui-ninezone/lib/toolbar/Toolbar";
import Direction from "@bentley/ui-ninezone/lib/utilities/Direction";

describe("NavigationWidget", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  const widgetProps: AnyWidgetProps = {
    classId: "NavigationWidget",
    defaultState: WidgetState.Open,
    isFreeform: true,
    iconSpec: "icon-home",
    labelKey: "SampleApp:Test.my-label",
    navigationAidId: "StandardRotationNavigationAid",
    horizontalDirection: Direction.Top,
    verticalDirection: Direction.Left,
  };

  it("NavigationWidgetDef from WidgetProps", () => {

    const widgetDef = WidgetDefFactory.create(widgetProps);
    expect(widgetDef).to.be.instanceof(NavigationWidgetDef);

    const navigationWidgetDef = widgetDef as NavigationWidgetDef;

    const reactElement = navigationWidgetDef.reactElement;
    expect(reactElement).to.not.be.undefined;

    const reactNode = navigationWidgetDef.renderCornerItem();
    expect(reactNode).to.not.be.undefined;
  });

  const horizontalToolbar =
    <Toolbar
      expandsTo={Direction.Bottom}
      items={
        <>
          <ToolButton toolId="tool1" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.tool1" />
          <ToolButton toolId="tool2" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.tool2" />
        </>
      }
    />;

  const verticalToolbar =
    <Toolbar
      expandsTo={Direction.Left}
      items={
        <>
          <ToolButton toolId="tool1" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.tool1" />
          <ToolButton toolId="tool2" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.tool2" />
        </>
      }
    />;

  it("NavigationWidget should render", () => {
    const wrapper = mount(
      <NavigationWidget
        horizontalToolbar={horizontalToolbar}
        verticalToolbar={verticalToolbar}
      />,
    );
    wrapper.unmount();
  });

  it("NavigationWidget should render correctly", () => {
    shallow(
      <NavigationWidget
        id="navigationWidget"
        horizontalToolbar={horizontalToolbar}
        verticalToolbar={verticalToolbar}
      />,
    ).should.matchSnapshot();
  });

});
