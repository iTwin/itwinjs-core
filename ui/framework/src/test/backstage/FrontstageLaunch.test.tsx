/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { Logger } from "@bentley/bentleyjs-core";
import { IModelApp, NoRenderApp } from "@bentley/imodeljs-frontend";
import { BackstageItem as NZ_BackstageItem } from "@bentley/ui-ninezone";
import {
  BackstageItemState, ConfigurableUiManager, Frontstage, FrontstageActivatedEventArgs, FrontstageLaunchBackstageItem, FrontstageManager,
  FrontstageProps, FrontstageProvider,
} from "../../ui-framework";
import { CoreTools } from "../../ui-framework/tools/CoreToolDefinitions";
import { SyncUiEventDispatcher } from "../../ui-framework/syncui/SyncUiEventDispatcher";
import TestUtils from "../TestUtils";

describe("Backstage", () => {
  const testEventId = "test-state-function-event";

  before(async () => {
    await TestUtils.initializeUiFramework();
    await NoRenderApp.startup();

    await FrontstageManager.setActiveFrontstageDef(undefined);
  });

  after(async () => {
    TestUtils.terminateUiFramework();
    await IModelApp.shutdown();
  });

  describe("<FrontstageLaunchBackstageItem />", () => {
    it("FrontstageLaunchBackstageItem should render & execute", async () => {
      const spyMethod = sinon.stub();
      let stateFuncRun = false;
      const stateFunc = (state: Readonly<BackstageItemState>): BackstageItemState => { // tslint:disable-line:deprecation
        stateFuncRun = true;
        return { ...state, isActive: true } as BackstageItemState; // tslint:disable-line:deprecation
      };

      class Frontstage1 extends FrontstageProvider {
        public get frontstage(): React.ReactElement<FrontstageProps> {
          return (
            <Frontstage
              id="Test1"
              defaultTool={CoreTools.selectElementCommand}
              defaultLayout="FourQuadrants"
              contentGroup="TestContentGroup1"
            />
          );
        }
      }
      ConfigurableUiManager.addFrontstageProvider(new Frontstage1());

      const remove = FrontstageManager.onFrontstageActivatedEvent.addListener((_args: FrontstageActivatedEventArgs) => spyMethod());
      const wrapper = mount(
        <FrontstageLaunchBackstageItem frontstageId="Test1" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder"
          isEnabled={true} isActive={false}
          stateSyncIds={[testEventId]} stateFunc={stateFunc} />,
      );

      expect(stateFuncRun).to.be.false;
      SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(testEventId);
      expect(stateFuncRun).to.be.true;
      wrapper.update();

      const backstageItem = wrapper.find(NZ_BackstageItem);
      backstageItem.find(".nz-backstage-item").simulate("click");

      await TestUtils.flushAsyncOperations();
      expect(spyMethod.calledOnce).to.be.true;
      remove();
      wrapper.unmount();
    });

    it("FrontstageLaunchBackstageItem should log error when invalid frontstageId is provided", async () => {
      const spyMethod = sinon.spy(Logger, "logError");
      const wrapper = mount(
        <FrontstageLaunchBackstageItem frontstageId="BadTest" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" />,
      );

      const backstageItem = wrapper.find(NZ_BackstageItem);
      backstageItem.find(".nz-backstage-item").simulate("click");
      spyMethod.calledOnce.should.true;

      wrapper.unmount();
      (Logger.logError as any).restore();
    });

    it("FrontstageLaunchBackstageItem renders correctly when inactive", async () => {
      await FrontstageManager.setActiveFrontstageDef(undefined);
      const wrapper = shallow(<FrontstageLaunchBackstageItem frontstageId="Test1" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" />);
      wrapper.should.matchSnapshot();
      wrapper.unmount();
    });

    it("FrontstageLaunchBackstageItem renders correctly when active", async () => {
      const frontstageDef = FrontstageManager.findFrontstageDef("Test1");
      expect(frontstageDef).to.not.be.undefined;

      if (frontstageDef) {
        await FrontstageManager.setActiveFrontstageDef(frontstageDef);
        const wrapper = shallow(<FrontstageLaunchBackstageItem frontstageId="Test1" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" />);
        wrapper.should.matchSnapshot();
        wrapper.unmount();
      }
    });

    it("FrontstageLaunchBackstageItem updates on frontstage activation", async () => {
      await FrontstageManager.setActiveFrontstageDef(undefined);
      const wrapper = mount(<FrontstageLaunchBackstageItem frontstageId="Test1" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" />);
      expect(wrapper.find("li.nz-active").length).to.eq(0);

      const frontstageDef = FrontstageManager.findFrontstageDef("Test1");
      expect(frontstageDef).to.not.be.undefined;

      if (frontstageDef) {
        await FrontstageManager.setActiveFrontstageDef(frontstageDef);
        wrapper.update();
        expect(wrapper.find("li.nz-active").length).to.eq(1);
      }

      wrapper.unmount();
    });

    it("FrontstageLaunchBackstageItem updates on property change", async () => {
      const wrapper = mount(<FrontstageLaunchBackstageItem frontstageId="Test1" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" isEnabled={false} />);
      expect(wrapper.find("li.nz-disabled").length).to.eq(1);

      wrapper.setProps({ isEnabled: true });
      wrapper.update();
      expect(wrapper.find("li.nz-disabled").length).to.eq(0);

      wrapper.unmount();
    });
  });
});
