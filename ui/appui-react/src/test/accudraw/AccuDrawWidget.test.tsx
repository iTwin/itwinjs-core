/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount } from "enzyme";
import * as React from "react";
import type { IModelAppOptions} from "@itwin/core-frontend";
import { MockRender } from "@itwin/core-frontend";
import { ConfigurableUiControlType } from "../../appui-react/configurableui/ConfigurableUiControl";
import type { WidgetProps } from "../../appui-react/widgets/WidgetProps";
import { WidgetDef } from "../../appui-react/widgets/WidgetDef";
import { FrameworkAccuDraw } from "../../appui-react/accudraw/FrameworkAccuDraw";
import { AccuDrawWidget, AccuDrawWidgetControl } from "../../appui-react/accudraw/AccuDrawWidget";
import { AccuDrawFieldContainer } from "../../appui-react/accudraw/AccuDrawFieldContainer";
import { TestUtils } from "../TestUtils";

describe("AccuDrawWidget", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();

    const opts: IModelAppOptions = {};
    opts.accuDraw = new FrameworkAccuDraw();
    await MockRender.App.startup(opts);
  });

  after(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiFramework();
  });

  it("should get AccuDrawWidgetControl", () => {
    const widgetProps: WidgetProps = {
      id: AccuDrawWidgetControl.id,
      label: AccuDrawWidgetControl.label,
      control: AccuDrawWidgetControl,
    };

    const widgetDef: WidgetDef = new WidgetDef(widgetProps);
    const widgetControl = widgetDef.getWidgetControl(ConfigurableUiControlType.Widget);

    expect(widgetControl).to.not.be.undefined;
    expect(widgetControl! instanceof AccuDrawWidgetControl).to.be.true;
    expect(widgetControl!.reactNode).to.not.be.undefined;
  });

  it("should mount AccuDrawWidget correctly", () => {
    const wrapper = mount(<AccuDrawWidget />);
    expect(wrapper.find(AccuDrawFieldContainer).length).to.eq(1);
    wrapper.unmount();
  });

});
