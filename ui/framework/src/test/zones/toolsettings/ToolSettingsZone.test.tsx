/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { Rectangle } from "@bentley/ui-core";
import { getDefaultZoneManagerProps, ToolSettings, ResizeHandle } from "@bentley/ui-ninezone";
import {
  ConfigurableUiManager,
  ToolUiProvider,
  ConfigurableCreateInfo,
  FrontstageProvider,
  FrontstageProps,
  Frontstage,
  Zone,
  Widget,
  FrontstageManager,
  FrontstageComposer,
  CoreTools,
  ToolSettingsZone,
  ToolSettingsZoneProps,
} from "../../../ui-framework";
import { Tool1 } from "../../tools/Tool1";
import { WidgetState } from "../../../ui-framework/widgets/WidgetDef";
import TestUtils, { ReactWrapper } from "../../TestUtils";

describe("ToolSettingsZone", () => {
  const sandbox = sinon.createSandbox();

  const widgetChangeHandler: ToolSettingsZoneProps["widgetChangeHandler"] = {
    handleResize: () => { },
    handleTabClick: () => { },
    handleTabDrag: () => { },
    handleTabDragEnd: () => { },
    handleTabDragStart: () => { },
    handleWidgetStateChange: () => { },
  };

  const targetChangeHandler = {} as ToolSettingsZoneProps["targetChangeHandler"];
  const getWidgetContentRef: ToolSettingsZoneProps["getWidgetContentRef"] = () => React.createRef();
  const zone = getDefaultZoneManagerProps(2);

  const props = {
    dropTarget: undefined,
    getWidgetContentRef,
    isHidden: false,
    isClosed: false,
    lastPosition: undefined,
    targetChangeHandler,
    targetedBounds: undefined,
    widgetChangeHandler,
    zone,
  };

  afterEach(() => {
    sandbox.restore();
  });

  class Tool1UiProvider extends ToolUiProvider {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);

      this.toolSettingsNode = <Tool1Settings />;
    }

    public execute(): void {
    }
  }

  class Tool1Settings extends React.Component {
    public render(): React.ReactNode {
      return (
        <div>
          <table>
            <tbody>
              <tr>
                <th>Type</th>
                <th>Input</th>
              </tr>
              <tr>
                <td>Month</td>
                <td> <input type="month" /> </td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    }
  }

  const testToolId = Tool1.toolId;

  before(async () => {
    await TestUtils.initializeUiFramework();

    class Frontstage1 extends FrontstageProvider {
      public get frontstage(): React.ReactElement<FrontstageProps> {
        return (
          <Frontstage
            id="ToolSettingsZone-TestFrontstage"
            defaultTool={CoreTools.selectElementCommand}
            defaultLayout="FourQuadrants"
            contentGroup="TestContentGroup1"
            topCenter={
              <Zone
                widgets={[
                  <Widget isToolSettings={true} />,
                ]}
              />
            }
          />
        );
      }
    }
    ConfigurableUiManager.addFrontstageProvider(new Frontstage1());

    class Frontstage2 extends FrontstageProvider {
      public get frontstage(): React.ReactElement<FrontstageProps> {
        return (
          <Frontstage
            id="ToolSettingsZone-TestFrontstage2"
            defaultTool={CoreTools.selectElementCommand}
            defaultLayout="FourQuadrants"
            contentGroup="TestContentGroup1"
            topCenter={
              <Zone
                widgets={[
                  <Widget isToolSettings={true} defaultState={WidgetState.Closed} />,
                ]}
              />
            }
          />
        );
      }
    }
    ConfigurableUiManager.addFrontstageProvider(new Frontstage2());

    ConfigurableUiManager.registerControl(testToolId, Tool1UiProvider);
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("close button closes it & tab opens it", async () => {
    // ToolSetting should open by default if a ToolUiProvider is specified for tool.
    await FrontstageManager.setActiveFrontstageDef(undefined);

    const wrapper = mount(<FrontstageComposer />);

    const frontstageDef = FrontstageManager.findFrontstageDef("ToolSettingsZone-TestFrontstage");
    expect(frontstageDef).to.not.be.undefined;

    if (frontstageDef) {
      await FrontstageManager.setActiveFrontstageDef(frontstageDef);

      FrontstageManager.ensureToolInformationIsSet(testToolId);
      FrontstageManager.setActiveToolId(testToolId);
      expect(FrontstageManager.activeToolId).to.eq(testToolId);

      wrapper.update();

      // it should be open by default
      const toolSettings = wrapper.find(".nz-widget-toolSettings");
      expect(toolSettings.length).to.eq(1);
      expect(wrapper.find(".nz-footer-dialog-button").length).to.eq(1);

      // simulate click to close it
      wrapper.find(".nz-footer-dialog-button").simulate("click");
      wrapper.update();
      expect(wrapper.find(".nz-widget-toolSettings").length).to.eq(0);
      expect(wrapper.find(".nz-footer-dialog-button").length).to.eq(0);

      // simulate click to open it
      wrapper.find(".nz-widget-toolSettings-tab").simulate("keyDown", { key: "Escape" });

      wrapper.find(".nz-widget-toolSettings-tab").simulate("click");
      wrapper.update();
      expect(wrapper.find(".nz-widget-toolSettings").length).to.eq(1);
      expect(wrapper.find(".nz-footer-dialog-button").length).to.eq(1);
    }

    wrapper.unmount();
  });

  it("should be closed with defaultState of Closed", async () => {
    // ToolSettings should closed by default.
    await FrontstageManager.setActiveFrontstageDef(undefined);

    const wrapper = mount(<FrontstageComposer />);

    const frontstageDef = FrontstageManager.findFrontstageDef("ToolSettingsZone-TestFrontstage2");
    expect(frontstageDef).to.not.be.undefined;

    if (frontstageDef) {
      await FrontstageManager.setActiveFrontstageDef(frontstageDef);

      FrontstageManager.ensureToolInformationIsSet(testToolId);
      FrontstageManager.setActiveToolId(testToolId);
      expect(FrontstageManager.activeToolId).to.eq(testToolId);

      wrapper.update();

      // it should be closed by default
      expect(wrapper.find(".nz-widget-toolSettings").length).to.eq(0);
      expect(wrapper.find(".nz-footer-dialog-button").length).to.eq(0);
    }

    wrapper.unmount();
  });

  it("should hide title bar buttons when floating", async () => {
    const floatingZone = {
      ...zone,
      floating: {
        bounds: new Rectangle(),
        stackId: 0,
      },
    };
    shallow(<ToolSettingsZone
      {...props}
      zone={floatingZone}
    />).dive().should.matchSnapshot();
  });

  it("should fill zone", async () => {
    const floatingZone = {
      ...zone,
      floating: {
        bounds: new Rectangle(),
        stackId: 0,
      },
      isLayoutChanged: true,
    };
    shallow(<ToolSettingsZone
      {...props}
      zone={floatingZone}
    />).dive().should.matchSnapshot();
  });

  it("should handle drag start", () => {
    const spy = sandbox.spy(props.widgetChangeHandler, "handleTabDragStart");
    const sut = mount<ToolSettingsZone>(<ToolSettingsZone
      {...props}
    />);
    const toolSettings = sut.find(ToolSettings) as ReactWrapper<ToolSettings>;

    const widgetBounds = { left: 980, top: 0, right: 1000, bottom: 20 };
    sinon.stub(toolSettings.instance(), "getBounds").returns(widgetBounds);

    const initialPosition = { x: 2, y: 4 };
    toolSettings.prop("onDragStart")!(initialPosition);

    expect(spy.calledOnceWithExactly(2, 0, sinon.match(initialPosition), sinon.match(widgetBounds))).to.true;
  });

  it("should not handle drag start with unset ref", () => {
    const spy = sandbox.spy(props.widgetChangeHandler, "handleTabDragStart");
    const ref = {
      current: null,
    };
    sinon.stub(ref, "current").set(() => { });
    sandbox.stub(React, "createRef").returns(ref);
    const sut = mount<ToolSettingsZone>(<ToolSettingsZone
      {...props}
    />);
    const toolSettings = sut.find(ToolSettings);

    const initialPosition = { x: 2, y: 4 };
    toolSettings.prop("onDragStart")!(initialPosition);

    expect(spy.called).to.false;
  });

  it("should handle resize", () => {
    const floatingZone = {
      ...zone,
      floating: {
        bounds: new Rectangle(),
        stackId: 0,
      },
    };
    const spy = sandbox.spy(props.widgetChangeHandler, "handleResize");
    const sut = mount<ToolSettingsZone>(<ToolSettingsZone
      {...props}
      zone={floatingZone}
    />);
    const toolSettings = sut.find(ToolSettings);
    toolSettings.prop("onResize")!(20, ResizeHandle.Left);

    expect(spy.calledOnceWithExactly(2, 20, ResizeHandle.Left, 0)).to.true;
  });
});
