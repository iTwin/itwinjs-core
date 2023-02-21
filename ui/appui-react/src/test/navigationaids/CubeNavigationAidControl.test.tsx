/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { AnyWidgetProps, CubeNavigationAidControl, NavigationWidgetDef, UiFramework } from "../../appui-react";
import TestUtils from "../TestUtils";

describe("CubeNavigationAidControl", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();

    if (!UiFramework.controls.isRegistered("CubeNavigationAid"))
      UiFramework.controls.register("CubeNavigationAid", CubeNavigationAidControl);
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  const widgetProps: AnyWidgetProps = { // eslint-disable-line deprecation/deprecation
    classId: "NavigationWidget",
    isFreeform: true,
    navigationAidId: "CubeNavigationAid",
  };

  it("CubeNavigationAidControl creates CubeNavigationAid", () => {
    const widgetDef = new NavigationWidgetDef(widgetProps); // eslint-disable-line deprecation/deprecation
    expect(widgetDef).to.be.instanceof(NavigationWidgetDef); // eslint-disable-line deprecation/deprecation

    const navigationWidgetDef = widgetDef;

    const reactNode = navigationWidgetDef.reactNode;
    expect(reactNode).to.not.be.undefined;

    const cornerNode = navigationWidgetDef.renderCornerItem();
    expect(cornerNode).to.not.be.undefined;
  });

});
