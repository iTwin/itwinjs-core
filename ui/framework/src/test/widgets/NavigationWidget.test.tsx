/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import { mount, shallow } from "enzyme";
import * as moq from "typemoq";

import { IModelConnection } from "@bentley/imodeljs-frontend";
import { WidgetState } from "@bentley/ui-abstract";
import { Toolbar, Direction } from "@bentley/ui-ninezone";

import TestUtils from "../TestUtils";
import {
  AnyWidgetProps,
  NavigationWidgetDef,
  ToolButton,
  NavigationWidget,
  ContentControl,
  ConfigurableCreateInfo,
  FrontstageManager,
  ItemList,
} from "../../ui-framework";
import { ConfigurableUiManager } from "../../ui-framework/configurableui/ConfigurableUiManager";
import { NavigationAidControl } from "../../ui-framework/navigationaids/NavigationAidControl";
import { CoreTools } from "../../ui-framework/CoreToolDefinitions";

describe("NavigationWidget", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
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

    const widgetDef = new NavigationWidgetDef(widgetProps); // tslint:disable-line:deprecation
    expect(widgetDef).to.be.instanceof(NavigationWidgetDef); // tslint:disable-line:deprecation

    const navigationWidgetDef = widgetDef as NavigationWidgetDef; // tslint:disable-line:deprecation

    const reactNode = navigationWidgetDef.reactNode;
    expect(reactNode).to.not.be.undefined;

    const cornerNode = navigationWidgetDef.renderCornerItem();
    expect(cornerNode).to.not.be.undefined;
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
      <NavigationWidget // tslint:disable-line:deprecation
        horizontalToolbar={horizontalToolbar}
        verticalToolbar={verticalToolbar}
      />,
    );
    wrapper.unmount();
  });

  it("NavigationWidget should render correctly", () => {
    shallow(
      <NavigationWidget // tslint:disable-line:deprecation
        id="navigationWidget"
        horizontalToolbar={horizontalToolbar}
        verticalToolbar={verticalToolbar}
      />,
    ).should.matchSnapshot();
  });

  it("NavigationWidget should render with an item list", () => {
    const hItemList = new ItemList([CoreTools.selectElementCommand]);
    const vItemList = new ItemList([CoreTools.fitViewCommand]);

    const wrapper = mount(
      <NavigationWidget // tslint:disable-line:deprecation
        horizontalItems={hItemList}
        verticalItems={vItemList}
      />,
    );
    wrapper.unmount();
  });

  it("NavigationWidget should support update", () => {
    const wrapper = mount(
      <NavigationWidget // tslint:disable-line:deprecation
        horizontalToolbar={horizontalToolbar}
        verticalToolbar={verticalToolbar}
      />,
    );
    expect(wrapper.find(ToolButton).length).to.eq(4);

    wrapper.setProps({ verticalToolbar: undefined });
    wrapper.update();
    expect(wrapper.find(ToolButton).length).to.eq(2);

    wrapper.unmount();
  });

  class TestContentControl extends ContentControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);

      this.reactNode = <div />;
    }
  }

  class TestNavigationAidControl extends NavigationAidControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);

      this.reactNode = <div>Test Navigation Aid</div>;
    }
  }

  it("NavigationWidgetDef with invalid navigation aid should throw Error", () => {
    const def = new NavigationWidgetDef({ // tslint:disable-line:deprecation
      navigationAidId: "Aid1",
    });
    ConfigurableUiManager.registerControl("Aid1", TestContentControl);
    expect(() => def.renderCornerItem()).to.throw(Error);
    ConfigurableUiManager.unregisterControl("Aid1");
  });

  it("NavigationWidgetDef should handle updateNavigationAid", () => {
    const def = new NavigationWidgetDef({ // tslint:disable-line:deprecation
      navigationAidId: "Aid1",
    });
    ConfigurableUiManager.registerControl("Aid1", TestNavigationAidControl);

    const element = def.reactNode;
    expect(def.reactNode).to.eq(element);
    const wrapper = mount(element as React.ReactElement<any>);

    const connection = moq.Mock.ofType<IModelConnection>();
    FrontstageManager.setActiveNavigationAid("Aid1", connection.object);
    wrapper.update();

    FrontstageManager.setActiveToolId(CoreTools.selectElementCommand.toolId);

    ConfigurableUiManager.unregisterControl("Aid1");
    wrapper.unmount();
  });

});
