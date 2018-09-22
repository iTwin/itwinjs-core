/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
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
  NavigationWidgetDef,
  ConfigurableUiManager,
  ItemPropsList,
  ToolButton,
  NavigationWidget,
} from "../../src/index";
import Toolbar from "@bentley/ui-ninezone/lib/toolbar/Toolbar";
import Direction from "@bentley/ui-ninezone/lib/utilities/Direction";

describe("NavigationWidget", () => {

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

    ConfigurableUiManager.loadCommonItems(commonItemsList);
  });

  const widgetProps: AnyWidgetProps = {
    classId: "NavigationWidget",
    defaultState: WidgetState.Open,
    isFreeform: true,
    iconClass: "icon-home",
    labelKey: "SampleApp:Test.my-label",
    navigationAidId: "StandardRotationNavigationAid",
    horizontalIds: ["tool1"],
    verticalIds: ["tool2"],
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

  it("NavigationWidget should mount with Ids", () => {
    const wrapper = mount(
      <NavigationWidget
        navigationAidId="StandardRotationNavigationAid"
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
        </>
      }
    />;

  const verticalToolbar =
    <Toolbar
      expandsTo={Direction.Left}
      items={
        <>
          <ToolButton toolId="tool1" iconClass="icon-placeholder" labelKey="SampleApp:buttons.tool1" />
          <ToolButton toolId="tool2" iconClass="icon-placeholder" labelKey="SampleApp:buttons.tool2" />
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
        horizontalToolbar={horizontalToolbar}
        verticalToolbar={verticalToolbar}
      />,
    ).should.matchSnapshot();
  });

});
