/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import { expect } from "chai";
import * as moq from "typemoq";

import {
  SheetNavigationAid,
  SheetNavigationAidControl,
  AnyWidgetProps,
  NavigationWidgetDef,
  ConfigurableUiManager,
  WidgetDefFactory,
} from "../../ui-framework";
import TestUtils from "../TestUtils";
import { IModelConnection, MockRender } from "@bentley/imodeljs-frontend";

describe("SheetNavigationAid", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();

    if (!ConfigurableUiManager.isControlRegistered("SheetNavigationAid"))
      ConfigurableUiManager.registerControl("SheetNavigationAid", SheetNavigationAidControl);

    MockRender.App.startup();
  });

  after(() => {
    MockRender.App.shutdown();
  });

  const connection = moq.Mock.ofType<IModelConnection>();

  describe("<SheetNavigationAid />", () => {
    it("should render", () => {
      const wrapper = mount(<SheetNavigationAid iModelConnection={connection.object} />);
      wrapper.unmount();
    });

    it("renders correctly", () => {
      shallow(<SheetNavigationAid iModelConnection={connection.object} />).should.matchSnapshot();
    });
  });

  describe("SheetNavigationAidControl", () => {

    const widgetProps: AnyWidgetProps = {
      classId: "NavigationWidget",
      isFreeform: true,
      navigationAidId: "SheetNavigationAid",
    };

    it("SheetNavigationAidControl creates SheetNavigationAid", () => {

      const widgetDef = WidgetDefFactory.create(widgetProps);
      expect(widgetDef).to.be.instanceof(NavigationWidgetDef);

      const navigationWidgetDef = widgetDef as NavigationWidgetDef;

      const reactElement = navigationWidgetDef.reactElement;
      expect(reactElement).to.not.be.undefined;

      const reactNode = navigationWidgetDef.renderCornerItem();
      expect(reactNode).to.not.be.undefined;
    });

  });
});
