/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { render } from "@testing-library/react";
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { BadgeType, StandardContentLayouts, WidgetState } from "@itwin/appui-abstract";
import { HorizontalAnchor, Tab as NZ_Tab, Stacked as NZ_WidgetStack, ResizeHandle, TabMode, VerticalAnchor } from "@itwin/appui-layout-react";
import {
  ConfigurableCreateInfo, ConfigurableUiManager, ContentGroup, CoreTools, Frontstage, FrontstageComposer, FrontstageManager,
  FrontstageProps, FrontstageProvider, Widget, WidgetControl, WidgetStack, WidgetStackProps, WidgetStackTab, WidgetStackTabGroup, WidgetStackTabGroupProps,
  WidgetStackTabs, Zone, ZoneState,
} from "../../appui-react";
import TestUtils, { mount } from "../TestUtils";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";

const defaultWidgetTabs = {
  [1]: [],
  [2]: [],
  [3]: [],
  [4]: [],
  [6]: [],
  [7]: [],
  [8]: [],
  [9]: [],
};

describe("WidgetStack", () => {
  before(async () => {
    await NoRenderApp.startup();
    await TestUtils.initializeUiFramework();
    FrontstageManager.clearFrontstageDefs();

    const frontstageProvider = new Frontstage1();
    ConfigurableUiManager.addFrontstageProvider(frontstageProvider);
  });

  after(async () => {
    TestUtils.terminateUiFramework();
    await IModelApp.shutdown();
  });

  class TestWidget1 extends WidgetControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);

      this.reactNode = (
        <div>
          <span>This is the Test Widget 1</span>
        </div>
      );
    }
  }

  class TestWidget2 extends WidgetControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);

      this.reactNode = (
        <div>
          <span>This is the Test Widget 2</span>
        </div>
      );
    }
  }

  class Frontstage1 extends FrontstageProvider {
    public static stageId = "WidgetStack-Frontstage";
    public get id(): string {
      return Frontstage1.stageId;
    }

    public get frontstage(): React.ReactElement<FrontstageProps> {
      const myContentGroup: ContentGroup = new ContentGroup({
        id: "test-group",
        layout: StandardContentLayouts.singleView,
        contents: [{ id: "main", classId: "TestContentControl2" }],
      });

      return (
        <Frontstage
          id={this.id}
          defaultTool={CoreTools.selectElementCommand}
          contentGroup={myContentGroup}
          centerRight={
            <Zone defaultState={ZoneState.Open}
              widgets={[
                <Widget id="widget1" control={TestWidget1} defaultState={WidgetState.Open} iconSpec="icon-placeholder" labelKey="SampleApp:Test.my-label" />, // eslint-disable-line react/jsx-key
                <Widget id="widget2" control={TestWidget2} defaultState={WidgetState.Open} iconSpec="icon-placeholder" labelKey="SampleApp:Test.my-label" />, // eslint-disable-line react/jsx-key
              ]}
            />
          }
        />
      );
    }
  }

  const getWidgetContentRef = moq.Mock.ofType<WidgetStackProps["getWidgetContentRef"]>();
  const widgetChangeHandler = moq.Mock.ofType<WidgetStackProps["widgetChangeHandler"]>();
  const props = {
    activeTabIndex: 0,
    disabledResizeHandles: undefined,
    draggedWidget: undefined,
    fillZone: false,
    getWidgetContentRef: getWidgetContentRef.object,
    horizontalAnchor: HorizontalAnchor.Left,
    isCollapsed: false,
    isFloating: false,
    isInStagePanel: false,
    openWidgetId: undefined,
    verticalAnchor: VerticalAnchor.Bottom,
    widgetChangeHandler: widgetChangeHandler.object,
    widgets: [],
    widgetTabs: defaultWidgetTabs,
  };

  beforeEach(() => {
    getWidgetContentRef.reset();
    widgetChangeHandler.reset();
  });

  it("should produce a WidgetStack with 2 widgets", async () => {
    await FrontstageManager.setActiveFrontstageDef(undefined);
    const wrapper = render(<FrontstageComposer />);

    const frontstageDef = await FrontstageManager.getFrontstageDef(Frontstage1.stageId);
    expect(frontstageDef).to.not.be.undefined;
    await FrontstageManager.setActiveFrontstageDef(frontstageDef);
    await TestUtils.flushAsyncOperations();
    // wrapper.debug();

    const stackedWidget = wrapper.container.querySelectorAll("div.nz-widget-stacked");
    expect(stackedWidget.length).to.eq(1);

    const tabs = wrapper.container.querySelectorAll("div.nz-draggable");
    expect(tabs.length).to.eq(2);
  });

  it("should not render w/o tabs", () => {
    const sut = shallow(<WidgetStack
      {...props}
    />);
    sut.should.matchSnapshot();
  });

  it("should not be resizable in stage panel", () => {
    const sut = shallow(<WidgetStack
      {...props}
      isInStagePanel={true}
      widgets={[6]}
      widgetTabs={{
        ...props.widgetTabs,
        [6]: [{
          title: "W6T1",
        }],
      }}
    />);
    sut.should.matchSnapshot();
  });

  it("should handle resize", () => {
    const sut = shallow(<WidgetStack
      {...props}
      widgets={[6]}
      widgetTabs={{
        ...props.widgetTabs,
        [6]: [{
          title: "W6T1",
        }],
      }}
    />);
    const nzWidgetStack = sut.find(NZ_WidgetStack);
    nzWidgetStack.prop("onResize")!(50, ResizeHandle.Left, 200);
    widgetChangeHandler.verify((x) => x.handleResize(6, 50, ResizeHandle.Left, 200), moq.Times.once());
  });

  it("should handle tab click", () => {
    const sut = mount(<WidgetStack
      {...props}
      widgets={[6]}
      widgetTabs={{
        ...props.widgetTabs,
        [6]: [{
          title: "W6T1",
        }],
      }}
    />);
    const widgetStackTabs = sut.find(WidgetStackTabs);
    widgetStackTabs.prop("onTabClick")!(6, 10);
    widgetChangeHandler.verify((x) => x.handleTabClick(6, 10), moq.Times.once());
  });

  it("should handle tab drag start", () => {
    const sut = mount(<WidgetStack
      {...props}
      widgets={[6]}
      widgetTabs={{
        ...props.widgetTabs,
        [6]: [{
          title: "W6T1",
        }],
      }}
    />);
    const widgetStackTabs = sut.find(WidgetStackTabs);
    widgetStackTabs.prop("onTabDragStart")!(6, 2, { x: 2, y: 4 }, { bottom: 60, left: 40, right: 80, top: 30 });
    widgetChangeHandler.verify((x) => x.handleTabDragStart(6, 2,
      moq.It.isObjectWith({ x: 2, y: 4 }),
      moq.It.isObjectWith({ bottom: 30, left: 0, right: 0, top: 30 }),
    ), moq.Times.once());
  });

  it("should handle tab drag start for horizontal widget", () => {
    const sut = mount(<WidgetStack
      {...props}
      verticalAnchor={VerticalAnchor.BottomPanel}
      widgets={[6]}
      widgetTabs={{
        ...props.widgetTabs,
        [6]: [{
          title: "W6T1",
        }],
      }}
    />);
    const widgetStackTabs = sut.find(WidgetStackTabs);
    widgetStackTabs.prop("onTabDragStart")!(6, 2, { x: 2, y: 4 }, { bottom: 60, left: 40, right: 80, top: 30 });
    widgetChangeHandler.verify((x) => x.handleTabDragStart(6, 2,
      moq.It.isObjectWith({ x: 2, y: 4 }),
      moq.It.isObjectWith({ bottom: 0, left: 40, right: 40, top: 0 }),
    ), moq.Times.once());
  });

  it("should not handle tab drag start if widget stack ref is not set", () => {
    const ref = {
      current: null,
    };
    sinon.stub(ref, "current").set(() => { });
    sinon.stub(React, "createRef").returns(ref);

    const sut = mount(<WidgetStack
      {...props}
      widgets={[6]}
      widgetTabs={{
        ...props.widgetTabs,
        [6]: [{
          title: "W6T1",
        }],
      }}
    />);
    const widgetStackTabs = sut.find(WidgetStackTabs);
    widgetStackTabs.prop("onTabDragStart")!(6, 2, { x: 2, y: 4 }, { bottom: 60, left: 40, right: 80, top: 30 });
    widgetChangeHandler.verify((x) => x.handleTabDragStart(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny()), moq.Times.never());
  });

  it("should handle tab drag", () => {
    const sut = mount(<WidgetStack
      {...props}
      widgets={[6]}
      widgetTabs={{
        ...props.widgetTabs,
        [6]: [{
          title: "W6T1",
        }],
      }}
    />);
    const widgetStackTabs = sut.find(WidgetStackTabs);
    widgetStackTabs.prop("onTabDrag")!({ x: 20, y: 50 });
    widgetChangeHandler.verify((x) => x.handleTabDrag(moq.It.isObjectWith({ x: 20, y: 50 })), moq.Times.once());
  });

  it("should handle tab drag end", () => {
    const sut = mount(<WidgetStack
      {...props}
      widgets={[6]}
      widgetTabs={{
        ...props.widgetTabs,
        [6]: [{
          title: "W6T1",
        }],
      }}
    />);
    const widgetStackTabs = sut.find(WidgetStackTabs);
    widgetStackTabs.prop("onTabDragEnd")!();
    widgetChangeHandler.verify((x) => x.handleTabDragEnd(), moq.Times.once());
  });
});

describe("WidgetStackTabs", () => {
  it("should not render tab group w/o tabs", () => {
    const sut = shallow(<WidgetStackTabs
      activeTabIndex={0}
      draggedWidget={undefined}
      horizontalAnchor={HorizontalAnchor.Left}
      isCollapsed={false}
      isProtruding={false}
      onTabClick={sinon.spy()}
      onTabDrag={sinon.spy()}
      onTabDragEnd={sinon.spy()}
      onTabDragStart={sinon.spy()}
      openWidgetId={undefined}
      verticalAnchor={VerticalAnchor.Bottom}
      widgets={[9]}
      widgetTabs={defaultWidgetTabs}
    />);
    sut.should.matchSnapshot();
  });
});

describe("WidgetStackTabGroup", () => {
  const onTabClick = moq.Mock.ofType<WidgetStackTabGroupProps["onTabClick"]>();
  const onTabDragStart = moq.Mock.ofType<WidgetStackTabGroupProps["onTabDragStart"]>();

  const props = {
    activeTabIndex: 0,
    draggedWidget: undefined,
    horizontalAnchor: HorizontalAnchor.Left,
    isCollapsed: false,
    isProtruding: false,
    isStacked: false,
    onTabClick: onTabClick.object,
    onTabDrag: sinon.spy(),
    onTabDragEnd: sinon.spy(),
    onTabDragStart: onTabDragStart.object,
    openWidgetId: undefined,
    tabs: [],
    verticalAnchor: VerticalAnchor.Bottom,
  };

  beforeEach(() => {
    onTabClick.reset();
    onTabDragStart.reset();
  });

  it("should render with draggedWidget", () => {
    const sut = shallow(<WidgetStackTabGroup
      {...props}
      draggedWidget={{
        id: 6,
        isUnmerge: false,
        lastPosition: {
          x: 10,
          y: 20,
        },
        tabIndex: 2,
      }}
      tabs={[{
        title: "Tab1",
      }, {
        title: "Tab2",
      }]}
      widgetId={6}
    />);
    sut.should.matchSnapshot();
  });

  it("should render with HandleMode.Visible", () => {
    const sut = shallow(<WidgetStackTabGroup
      {...props}
      draggedWidget={{
        id: 6,
        isUnmerge: true,
        lastPosition: {
          x: 10,
          y: 20,
        },
        tabIndex: 2,
      }}
      tabs={[
        {
          title: "Tab1",
        },
        {
          title: "Tab2",
        },
      ]}
      widgetId={6}
    />);
    sut.should.matchSnapshot();
  });

  it("should render with HandleMode.Hovered", () => {
    const sut = shallow(<WidgetStackTabGroup
      {...props}
      isStacked
      tabs={[
        {
          title: "Tab1",
        },
        {
          title: "Tab2",
        },
      ]}
      widgetId={6}
    />);
    sut.should.matchSnapshot();
  });

  it("should handle tab drag start", () => {
    const sut = mount<WidgetStackTabGroup>(<WidgetStackTabGroup
      {...props}
      isStacked
      tabs={[{
        title: "Tab1",
      }]}
      widgetId={6}
    />);
    const widgetStackTab = sut.find(WidgetStackTab);
    widgetStackTab.prop("onDragStart")(0, { x: 10, y: 20 });
    onTabDragStart.verify((x) => x(6, 0,
      moq.It.isObjectWith({ x: 10, y: 20 }),
      moq.It.isObjectWith({ bottom: 0, left: 0, right: 0, top: 0 }),
    ), moq.Times.once());
  });

  it("should not handle tab drag start if first tab ref is not set", () => {
    const ref = {
      current: null,
    };
    sinon.stub(ref, "current").set(() => { });
    sinon.stub(React, "createRef").returns(ref);

    const sut = mount<WidgetStackTabGroup>(<WidgetStackTabGroup
      {...props}
      isStacked
      tabs={[{
        title: "Tab1",
      }]}
      widgetId={6}
    />);
    const widgetStackTab = sut.find(WidgetStackTab);
    widgetStackTab.prop("onDragStart")(0, { x: 10, y: 20 });
    onTabDragStart.verify((x) => x(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAny()), moq.Times.never());
  });

  it("should handle tab click", () => {
    const ref = {
      current: null,
    };
    sinon.stub(ref, "current").set(() => { });
    sinon.stub(React, "createRef").returns(ref);

    const sut = mount<WidgetStackTabGroup>(<WidgetStackTabGroup
      {...props}
      isStacked
      tabs={[{
        title: "Tab1",
      }]}
      widgetId={6}
    />);
    const widgetStackTab = sut.find(WidgetStackTab);
    widgetStackTab.prop("onClick")(0);
    onTabClick.verify((x) => x(6, 0), moq.Times.once());
  });
});

describe("WidgetStackTab", () => {
  it("should render with beta badge", () => {
    shallow(<WidgetStackTab
      horizontalAnchor={HorizontalAnchor.Left}
      index={0}
      badgeType={BadgeType.TechnicalPreview}
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
      badgeType={BadgeType.TechnicalPreview}
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
      badgeType={BadgeType.TechnicalPreview}
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
