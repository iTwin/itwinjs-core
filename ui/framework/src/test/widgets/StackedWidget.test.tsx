/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount } from "enzyme";
import { expect } from "chai";
import TestUtils from "../TestUtils";
import {
  ZoneState,
  WidgetState,
  ConfigurableUiManager,
  WidgetControl,
  ConfigurableCreateInfo,
  FrontstageManager,
  FrontstageComposer,
  ContentGroup,
  ContentLayoutDef,
  FrontstageProvider,
  FrontstageProps,
  Frontstage,
  Zone,
  Widget,
} from "../../ui-framework";

describe("StackedWidget", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  class TestWidget1 extends WidgetControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);

      this.reactElement = (
        <div>
          <span>This is the Test Widget 1</span>
        </div>
      );
    }
  }

  class TestWidget2 extends WidgetControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);

      this.reactElement = (
        <div>
          <span>This is the Test Widget 2</span>
        </div>
      );
    }
  }

  it("Producing a StackedWidget", async () => {

    class Frontstage1 extends FrontstageProvider {

      public get frontstage(): React.ReactElement<FrontstageProps> {
        const myContentGroup: ContentGroup = new ContentGroup({
          contents: [{ classId: "TestContentControl2" }],
        });

        const myContentLayout: ContentLayoutDef = new ContentLayoutDef({
          id: "SingleContent",
          descriptionKey: "UiFramework:tests.singleContent",
          priority: 100,
        });

        return (
          <Frontstage
            id="StackedWidget-Frontstage"
            defaultToolId="PlaceLine"
            defaultLayout={myContentLayout}
            contentGroup={myContentGroup}
            centerRight={
              <Zone defaultState={ZoneState.Open}
                widgets={[
                  <Widget id="widget1" control={TestWidget1} defaultState={WidgetState.Open} iconSpec="icon-placeholder" labelKey="SampleApp:Test.my-label" />,
                  <Widget id="widget2" control={TestWidget2} defaultState={WidgetState.Open} iconSpec="icon-placeholder" labelKey="SampleApp:Test.my-label" />,
                ]}
              />
            }
          />
        );
      }
    }

    const frontstageProvider = new Frontstage1();
    ConfigurableUiManager.addFrontstageProvider(frontstageProvider);

    FrontstageManager.setActiveFrontstageDef(undefined); // tslint:disable-line:no-floating-promises

    const wrapper = mount(<FrontstageComposer />);

    const frontstageDef = ConfigurableUiManager.findFrontstageDef("StackedWidget-Frontstage");
    expect(frontstageDef).to.not.be.undefined;
    await FrontstageManager.setActiveFrontstageDef(frontstageDef);
    wrapper.update();

    const stackedWidget = wrapper.find("div.nz-widget-stacked");
    expect(stackedWidget.length).to.eq(1);

    const tabs = wrapper.find("div.nz-draggable");
    expect(tabs.length).to.eq(2);

    // TODO - tab click, resize, tab drag

    wrapper.unmount();
  });

});
