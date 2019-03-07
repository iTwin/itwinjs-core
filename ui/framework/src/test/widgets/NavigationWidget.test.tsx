/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import { mount, shallow } from "enzyme";
import * as moq from "typemoq";
import TestUtils from "../TestUtils";
import {
  AnyWidgetProps,
  WidgetState,
  WidgetDefFactory,
  NavigationWidgetDef,
  ToolButton,
  NavigationWidget,
  ContentControl,
  ConfigurableCreateInfo,
  FrontstageManager,
} from "../../ui-framework";
import { Toolbar, Direction } from "@bentley/ui-ninezone";
import ConfigurableUiManager from "../../ui-framework/configurableui/ConfigurableUiManager";
import { NavigationAidControl } from "../../ui-framework/navigationaids/NavigationAidControl";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { CoreTools } from "../../ui-framework/CoreToolDefinitions";

describe("NavigationWidget", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  const widgetProps: AnyWidgetProps = {
    id: "navigationWidget",
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

  class TestContentControl extends ContentControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);

      this.reactElement = <div />;
    }
  }

  class TestNavigationAidControl extends NavigationAidControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);

      this.reactElement = <div>Test Navigation Aid</div>;
    }
  }

  it("NavigationWidgetDef with invalid navigation aid should throw Error", () => {
    const def = new NavigationWidgetDef({
      navigationAidId: "Aid1",
    });
    ConfigurableUiManager.registerControl("Aid1", TestContentControl);
    expect(() => def.renderCornerItem()).to.throw(Error);
    ConfigurableUiManager.unregisterControl("Aid1");
  });

  it("NavigationWidgetDef should handle updateNavigationAid", () => {
    const def = new NavigationWidgetDef({
      navigationAidId: "Aid1",
    });
    ConfigurableUiManager.registerControl("Aid1", TestNavigationAidControl);

    const element = def.reactElement;
    expect(def.reactElement).to.eq(element);
    const wrapper = mount(element as React.ReactElement<any>);

    const connection = moq.Mock.ofType<IModelConnection>();
    FrontstageManager.setActiveNavigationAid("Aid1", connection.object);
    wrapper.update();

    FrontstageManager.setActiveToolId(CoreTools.selectElementCommand.toolId);

    ConfigurableUiManager.unregisterControl("Aid1");
    wrapper.unmount();
  });

});
