/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import * as sinon from "sinon";
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
  CoreTools,
} from "../../ui-framework";
import { WidgetStackTab } from "../../ui-framework/widgets/WidgetStack";
import { HorizontalAnchor, TabMode, VerticalAnchor, Tab as NZ_Tab } from "@bentley/ui-ninezone";

describe("WidgetStack", () => {

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
          id="WidgetStack-Frontstage"
          defaultTool={CoreTools.selectElementCommand}
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

  before(() => {
    const frontstageProvider = new Frontstage1();
    ConfigurableUiManager.addFrontstageProvider(frontstageProvider);
  });

  it("should produce a WidgetStack with 2 widgets", async () => {
    await FrontstageManager.setActiveFrontstageDef(undefined);
    const wrapper = mount(<FrontstageComposer />);

    const frontstageDef = ConfigurableUiManager.findFrontstageDef("WidgetStack-Frontstage");
    expect(frontstageDef).to.not.be.undefined;
    await FrontstageManager.setActiveFrontstageDef(frontstageDef);
    wrapper.update();

    const stackedWidget = wrapper.find("div.nz-widget-stacked");
    expect(stackedWidget.length).to.eq(1);

    const tabs = wrapper.find("div.nz-draggable");
    expect(tabs.length).to.eq(2);

    wrapper.unmount();
  });
});

describe("WidgetStackTab", () => {
  it("should render with beta badge", () => {
    shallow(<WidgetStackTab
      horizontalAnchor={HorizontalAnchor.Left}
      index={0}
      isBetaBadgeVisible={true}
      isCollapsed={false}
      isProtruding={false}
      lastPosition={undefined}
      mode={TabMode.Active}
      onClick={sinon.spy()}
      onDrag={sinon.spy()}
      onDragEnd={sinon.spy()}
      onDragStart={sinon.spy()}
      title=""
      verticalAnchor={VerticalAnchor.Bottom}
    />).should.matchSnapshot();
  });

  it("should invoke onDragStart with index", () => {
    const spy = sinon.spy();
    const sut = shallow(<WidgetStackTab
      horizontalAnchor={HorizontalAnchor.Left}
      index={0}
      isBetaBadgeVisible={true}
      isCollapsed={false}
      isProtruding={false}
      lastPosition={undefined}
      mode={TabMode.Active}
      onClick={sinon.spy()}
      onDrag={sinon.spy()}
      onDragEnd={sinon.spy()}
      onDragStart={spy}
      title=""
      verticalAnchor={VerticalAnchor.Bottom}
    />);
    const nzTab = sut.find(NZ_Tab);
    const initialPosition = { x: 0, y: 1 };
    nzTab.prop("onDragStart")!(initialPosition);
    spy.calledOnceWithExactly(0, initialPosition).should.true;
  });

  it("should invoke onClick with index", () => {
    const spy = sinon.spy();
    const sut = shallow(<WidgetStackTab
      horizontalAnchor={HorizontalAnchor.Left}
      index={5}
      isBetaBadgeVisible={true}
      isCollapsed={false}
      isProtruding={false}
      lastPosition={undefined}
      mode={TabMode.Active}
      onClick={spy}
      onDrag={sinon.spy()}
      onDragEnd={sinon.spy()}
      onDragStart={sinon.spy()}
      title=""
      verticalAnchor={VerticalAnchor.Bottom}
    />);
    const nzTab = sut.find(NZ_Tab);
    nzTab.prop("onClick")!();
    spy.calledOnceWithExactly(5).should.true;
  });
});
