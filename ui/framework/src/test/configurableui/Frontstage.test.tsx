/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import * as sinon from "sinon";
import { expect } from "chai";

import TestUtils from "../TestUtils";
import {
  Frontstage,
  FrontstageProvider,
  FrontstageProps,
  ContentLayoutDef,
  Zone,
  Widget,
  ContentGroup,
  FrontstageManager,
  ZoneState,
  ContentControl,
  ConfigurableCreateInfo,
  WidgetState,
  WidgetControl,
  ZoneLocation,
  FrontstageComposer,
} from "../../ui-framework";

describe("Frontstage", () => {

  class TestContentControl extends ContentControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);

      this.reactElement = <div />;
    }
  }

  class TestWidget extends WidgetControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);

      this.reactElement = <div />;
    }
  }

  class Frontstage1 extends FrontstageProvider {

    public get frontstage(): React.ReactElement<FrontstageProps> {
      const contentLayoutDef: ContentLayoutDef = new ContentLayoutDef(
        {
          id: "SingleContent",
          descriptionKey: "App:ContentLayoutDef.SingleContent",
          priority: 100,
        },
      );

      const myContentGroup: ContentGroup = new ContentGroup(
        {
          contents: [
            {
              classId: TestContentControl,
              applicationData: { label: "Content 1a", bgColor: "black" },
            },
          ],
        },
      );

      return (
        <Frontstage
          id="Test1"
          defaultToolId="Select"
          defaultLayout={contentLayoutDef}
          contentGroup={myContentGroup}
          defaultContentId="defaultContentId"
          isInFooterMode={false}
          applicationData={{ key: "value" }}
          topLeft={
            <Zone defaultState={ZoneState.Open} allowsMerging={true} applicationData={{ key: "value" }}
              widgets={[
                <Widget isFreeform={true} element={<div />} />,
              ]}
            />
          }
          topCenter={
            <Zone
              widgets={[
                <Widget isToolSettings={true} />,
              ]}
            />
          }
          centerRight={
            <Zone defaultState={ZoneState.Open}
              widgets={[
                <Widget id="widget1" defaultState={WidgetState.Open} element={<div />} />,
              ]}
            />
          }
          bottomCenter={
            <Zone
              widgets={[
                <Widget id="statusBar" isStatusBar={true} iconSpec="icon-placeholder" labelKey="App:widgets.StatusBar"
                  control={TestWidget} applicationData={{ key: "value" }} />,
              ]}
            />
          }
          bottomRight={
            <Zone defaultState={ZoneState.Open} mergeWithZone={ZoneLocation.CenterRight}
              widgets={[
                <Widget id="widget1" defaultState={WidgetState.Open} element={<div />} />,
                <Widget id="widget2" defaultState={WidgetState.Hidden} element={<div />} />,
              ]}
            />
          }
        />
      );
    }
  }

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  it("should render", () => {
    mount(<Frontstage id="test1" defaultToolId="Select" defaultLayout="defaultLayout1" contentGroup="contentGroup1" />);
  });

  it("renders correctly", () => {
    shallow(<Frontstage id="test1" defaultToolId="Select" defaultLayout="defaultLayout1" contentGroup="contentGroup1" />).should.matchSnapshot();
  });

  it("FrontstageProvider supplies valid Frontstage", () => {
    const spyMethod = sinon.spy();
    const frontstageProvider = new Frontstage1();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef).then(() => { // tslint:disable-line:no-floating-promises
      spyMethod();
    });
    setImmediate(() => {
      spyMethod.calledOnce.should.true;

      const widgetDef = FrontstageManager.findWidget("widget1");
      expect(widgetDef).to.not.be.undefined;

      if (widgetDef) {
        widgetDef.setWidgetState(WidgetState.Open);
        expect(widgetDef.isPressed).to.eq(true);
        expect(widgetDef.isVisible).to.eq(true);

        FrontstageManager.setWidgetState("widget1", WidgetState.Hidden);
        expect(widgetDef.isVisible).to.eq(false);
      }
    });
  });

  it("FrontstageProvider supplies Frontstage to FrontstageComposer", () => {
    const wrapper = mount(<FrontstageComposer />);

    const spyMethod = sinon.spy();
    const frontstageProvider = new Frontstage1();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef).then(() => { // tslint:disable-line:no-floating-promises
      spyMethod();
    });
    setImmediate(() => {
      spyMethod.calledOnce.should.true;

      const widgetDef2 = FrontstageManager.findWidget("widget2");
      expect(widgetDef2).to.not.be.undefined;
      if (widgetDef2) {
        expect(widgetDef2.isVisible).to.eq(false);
        expect(widgetDef2.isPressed).to.eq(false);

        widgetDef2.setWidgetState(WidgetState.Open);
        wrapper.update();
        expect(widgetDef2.isVisible).to.eq(true);
        expect(widgetDef2.isPressed).to.eq(true);

        widgetDef2.setWidgetState(WidgetState.Hidden);
        wrapper.update();
        expect(widgetDef2.isVisible).to.eq(false);
      }

      wrapper.unmount();
    });
  });

});
