/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { shallow } from "enzyme";
import * as React from "react";
import * as moq from "typemoq";
import { IModelConnection, MockRender } from "@itwin/core-frontend";
import { AnyWidgetProps, ConfigurableUiManager, NavigationWidgetDef, SheetNavigationAid, SheetNavigationAidControl } from "../../appui-react";
import TestUtils, { mount } from "../TestUtils";

describe("SheetNavigationAid", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();

    if (!ConfigurableUiManager.isControlRegistered("SheetNavigationAid"))
      ConfigurableUiManager.registerControl("SheetNavigationAid", SheetNavigationAidControl);

    await MockRender.App.startup();
  });

  after(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiFramework();
  });

  const connection = moq.Mock.ofType<IModelConnection>();

  describe("<SheetNavigationAid />", () => {
    it("should mount and unmount", () => {
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

      const widgetDef = new NavigationWidgetDef(widgetProps); // eslint-disable-line deprecation/deprecation
      expect(widgetDef).to.be.instanceof(NavigationWidgetDef); // eslint-disable-line deprecation/deprecation

      const navigationWidgetDef = widgetDef;

      const reactNode = navigationWidgetDef.reactNode;
      expect(reactNode).to.not.be.undefined;

      const cornerNode = navigationWidgetDef.renderCornerItem();
      expect(cornerNode).to.not.be.undefined;
    });

  });
});
