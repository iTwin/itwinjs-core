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
} from "../../src/index";

describe("Frontstage", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  it("should render", () => {
    mount(<Frontstage id="test1" defaultToolId="Select" defaultLayout="defaultLayout1" contentGroup="contentGroup1" />);
  });

  it("renders correctly", () => {
    shallow(<Frontstage id="test1" defaultToolId="Select" defaultLayout="defaultLayout1" contentGroup="contentGroup1" />).should.matchSnapshot();
  });

  it("FrontstageProvider", () => {

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
            bottomCenter={
              <Zone defaultState={ZoneState.Open}
                widgets={[
                  <Widget id="statusBar" defaultState={WidgetState.Open} isStatusBar={true} iconClass="icon-placeholder" labelKey="App:widgets.StatusBar"
                    control={TestWidget} applicationData={{ key: "value" }} />,
                ]}
              />
            }
            bottomRight={
              <Zone
                widgets={[
                  <Widget id="widget1" defaultState={WidgetState.Open} element={<div />} />,
                  <Widget id="widget2" defaultState={WidgetState.Open} element={<div />} />,
                ]}
              />
            }
          />
        );
      }
    }

    const spyMethod = sinon.spy();
    const frontstageProvider = new Frontstage1();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef).then(() => {
      spyMethod();
    });
    setImmediate(() => {
      spyMethod.calledOnce.should.true;

      const widgetDef = FrontstageManager.findWidget("widget1");
      expect(widgetDef).to.not.be.undefined;

      if (widgetDef) {
        widgetDef.setWidgetState(WidgetState.Open);
        expect(widgetDef.widgetState).to.eq(WidgetState.Open);

        FrontstageManager.setWidgetState("widget1", WidgetState.Off);
        expect(widgetDef.widgetState).to.eq(WidgetState.Off);
      }
    });

  });

});
