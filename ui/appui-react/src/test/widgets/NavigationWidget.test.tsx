/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as moq from "typemoq";
import { IModelApp, IModelConnection, NoRenderApp } from "@itwin/core-frontend";
import { WidgetState } from "@itwin/appui-abstract";
import { Direction, Toolbar } from "@itwin/appui-layout-react";
import {
  AnyWidgetProps, ConfigurableCreateInfo, ContentControl, ItemList, NavigationAidHost, NavigationWidget, NavigationWidgetDef,
  ToolButton,
  UiFramework,
} from "../../appui-react";
import { CoreTools } from "../../appui-react/tools/CoreToolDefinitions";
import { FrameworkVersion } from "../../appui-react/hooks/useFrameworkVersion";
import { NavigationAidControl } from "../../appui-react/navigationaids/NavigationAidControl";
import TestUtils, { storageMock } from "../TestUtils";
import { Provider } from "react-redux";

describe("NavigationWidget localStorage Wrapper", () => {

  const localStorageToRestore = Object.getOwnPropertyDescriptor(window, "localStorage")!;
  const localStorageMock = storageMock();

  before(async () => {
    Object.defineProperty(window, "localStorage", {
      get: () => localStorageMock,
    });
  });

  after(() => {
    Object.defineProperty(window, "localStorage", localStorageToRestore);
  });

  describe("NavigationWidget", () => {
    before(async () => {
      await NoRenderApp.startup();
      await TestUtils.initializeUiFramework();
      UiFramework.setUiVersion("1"); // eslint-disable-line deprecation/deprecation
      await TestUtils.flushAsyncOperations();
    });

    after(async () => {
      TestUtils.terminateUiFramework();
      await IModelApp.shutdown();
    });

    const widgetProps: AnyWidgetProps = { // eslint-disable-line deprecation/deprecation
      id: "navigationWidget",
      classId: "NavigationWidget",
      defaultState: WidgetState.Open,
      isFreeform: true,
      iconSpec: "icon-home",
      labelKey: "SampleApp:Test.my-label",
      navigationAidId: "StandardRotationNavigationAid",
      horizontalDirection: Direction.Top, // eslint-disable-line deprecation/deprecation
      verticalDirection: Direction.Left, // eslint-disable-line deprecation/deprecation
    };

    it("NavigationWidgetDef from WidgetProps", () => {

      const widgetDef = new NavigationWidgetDef(widgetProps); // eslint-disable-line deprecation/deprecation
      expect(widgetDef).to.be.instanceof(NavigationWidgetDef); // eslint-disable-line deprecation/deprecation

      const navigationWidgetDef = widgetDef;

      const reactNode = navigationWidgetDef.reactNode;
      expect(reactNode).to.not.be.undefined;

      const cornerNode = navigationWidgetDef.renderCornerItem();
      expect(cornerNode).to.not.be.undefined;
    });

    const horizontalToolbar =
      <Toolbar // eslint-disable-line deprecation/deprecation
        expandsTo={Direction.Bottom} // eslint-disable-line deprecation/deprecation
        items={
          <>
            {/* eslint-disable-next-line deprecation/deprecation */}
            <ToolButton toolId="tool1" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.tool1" />
            {/* eslint-disable-next-line deprecation/deprecation */}
            <ToolButton toolId="tool2" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.tool2" />
          </>
        }
      />;

    const verticalToolbar =
      <Toolbar // eslint-disable-line deprecation/deprecation
        expandsTo={Direction.Left} // eslint-disable-line deprecation/deprecation
        items={
          <>
            {/* eslint-disable-next-line deprecation/deprecation */}
            <ToolButton toolId="tool1" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.tool1" />
            {/* eslint-disable-next-line deprecation/deprecation */}
            <ToolButton toolId="tool2" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.tool2" />
          </>
        }
      />;

    it("NavigationWidget should render", async () => {
      mount(
        <Provider store={TestUtils.store} >
          {/* eslint-disable-next-line deprecation/deprecation */}
          <FrameworkVersion>
            <NavigationWidget // eslint-disable-line deprecation/deprecation
              horizontalToolbar={horizontalToolbar}
              verticalToolbar={verticalToolbar}
            />
          </FrameworkVersion>
        </Provider>
      );
    });

    it("NavigationWidget should render correctly", async () => {
      shallow(
        <Provider store={TestUtils.store} >
          {/* eslint-disable-next-line deprecation/deprecation */}
          <FrameworkVersion>
            <NavigationWidget // eslint-disable-line deprecation/deprecation
              id="navigationWidget"
              horizontalToolbar={horizontalToolbar}
              verticalToolbar={verticalToolbar}
            />
          </FrameworkVersion>
        </Provider>,
      ).should.matchSnapshot();
    });

    it("NavigationWidget should render with an item list", async () => {
      const hItemList = new ItemList([CoreTools.selectElementCommand]);
      const vItemList = new ItemList([CoreTools.fitViewCommand]);
      mount(
        <Provider store={TestUtils.store} >
          {/* eslint-disable-next-line deprecation/deprecation */}
          <FrameworkVersion>
            <NavigationWidget // eslint-disable-line deprecation/deprecation
              horizontalItems={hItemList}
              verticalItems={vItemList}
            />
          </FrameworkVersion>
        </Provider>
      );
    });

    it("NavigationWidget should support update", () => {
      const wrapper = mount(
        <NavigationWidget // eslint-disable-line deprecation/deprecation
          horizontalToolbar={horizontalToolbar}
          verticalToolbar={verticalToolbar}
        />,
      );
      expect(wrapper.find(ToolButton).length).to.eq(4); {/* eslint-disable-line deprecation/deprecation */}

      wrapper.setProps({ verticalToolbar: undefined });
      wrapper.update();
      expect(wrapper.find(ToolButton).length).to.eq(2); {/* eslint-disable-line deprecation/deprecation */}
    });

    class TestContentControl extends ContentControl {
      constructor(info: ConfigurableCreateInfo, options: any) {
        super(info, options);

        this.reactNode = <div />;
      }
    }

    class TestNavigationAidControl extends NavigationAidControl {
      constructor(info: ConfigurableCreateInfo, options: any) {
        super(info, options);

        this.reactNode = <div>Test Navigation Aid</div>;
      }
    }

    it("NavigationWidgetDef with invalid navigation aid should throw Error", () => {
      const def = new NavigationWidgetDef({ // eslint-disable-line deprecation/deprecation
        navigationAidId: "Aid1",
      });
      UiFramework.controls.register("Aid1", TestContentControl);
      expect(() => def.renderCornerItem()).to.throw(Error);
      UiFramework.controls.unregister("Aid1");
    });

    it("NavigationWidgetDef should handle updateNavigationAid", () => {
      const def = new NavigationWidgetDef({ // eslint-disable-line deprecation/deprecation
        navigationAidId: "Aid1",
      });
      UiFramework.controls.register("Aid1", TestNavigationAidControl);

      const element = def.reactNode;
      expect(def.reactNode).to.eq(element);
      const wrapper = mount(element as React.ReactElement<any>);

      const connection = moq.Mock.ofType<IModelConnection>();
      UiFramework.frontstages.setActiveNavigationAid("Aid1", connection.object);
      wrapper.update();

      UiFramework.frontstages.setActiveToolId(CoreTools.selectElementCommand.toolId);

      UiFramework.controls.unregister("Aid1");
    });

    it("NavigationAidHost should render in 2.0 mode",  async () => {
      UiFramework.setUiVersion("2"); // eslint-disable-line deprecation/deprecation
      await TestUtils.flushAsyncOperations();

      mount(
        <Provider store={TestUtils.store} >
          <FrameworkVersion> {/* eslint-disable-line deprecation/deprecation */}
            <NavigationAidHost />
          </FrameworkVersion>
        </Provider>);
    });

    it("NavigationAidHost should render in 2.0 mode with snapWidgetOpacity", async () => {
      UiFramework.visibility.snapWidgetOpacity = true;
      mount(
        <Provider store={TestUtils.store} >
          <FrameworkVersion> {/* eslint-disable-line deprecation/deprecation */}
            <NavigationAidHost />
          </FrameworkVersion>
        </Provider>);
      UiFramework.visibility.snapWidgetOpacity = false;
    });
  });
});
