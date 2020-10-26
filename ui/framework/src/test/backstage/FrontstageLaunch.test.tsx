/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { Logger } from "@bentley/bentleyjs-core";
import { IModelApp, NoRenderApp } from "@bentley/imodeljs-frontend";
import { BackstageItem as NZ_BackstageItem } from "@bentley/ui-ninezone";
import {
  BackstageItemState, ConfigurableUiManager, CoreTools, Frontstage, FrontstageLaunchBackstageItem, FrontstageManager,
  FrontstageProps, FrontstageProvider, SyncUiEventDispatcher,
} from "../../ui-framework";
import TestUtils, { mount } from "../TestUtils";

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
      let stateFuncRun = false;
      const stateFunc = (state: Readonly<BackstageItemState>): BackstageItemState => { // eslint-disable-line deprecation/deprecation
        stateFuncRun = true;
        return { ...state, isActive: true } as BackstageItemState; // eslint-disable-line deprecation/deprecation
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

      const spy = sinon.spy(FrontstageManager.onFrontstageActivatedEvent, "emit");
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
      expect(spy.calledOnce).to.be.true;
    });

    it("FrontstageLaunchBackstageItem should log error when invalid frontstageId is provided", async () => {
      const spyMethod = sinon.spy(Logger, "logError");
      const wrapper = mount(
        <FrontstageLaunchBackstageItem frontstageId="BadTest" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" />,
      );

      const backstageItem = wrapper.find(NZ_BackstageItem);
      backstageItem.find(".nz-backstage-item").simulate("click");
      spyMethod.calledOnce.should.true;
    });

    it("FrontstageLaunchBackstageItem renders correctly when inactive", async () => {
      await FrontstageManager.setActiveFrontstageDef(undefined);
      const wrapper = shallow(<FrontstageLaunchBackstageItem frontstageId="Test1" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" />);
      wrapper.should.matchSnapshot();
    });

    it("FrontstageLaunchBackstageItem renders correctly when active", async () => {
      const frontstageDef = FrontstageManager.findFrontstageDef("Test1");
      expect(frontstageDef).to.not.be.undefined;

      if (frontstageDef) {
        await FrontstageManager.setActiveFrontstageDef(frontstageDef);
        const wrapper = shallow(<FrontstageLaunchBackstageItem frontstageId="Test1" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" />);
        wrapper.should.matchSnapshot();
      }
    });

    it("FrontstageLaunchBackstageItem updates on frontstage activation", async () => {
      await FrontstageManager.setActiveFrontstageDef(undefined);
      const wrapper = mount(<FrontstageLaunchBackstageItem frontstageId="Test1" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" />);
      expect(wrapper.find("li.nz-active").length).to.eq(0);

      const frontstageDef = FrontstageManager.findFrontstageDef("Test1");
      expect(frontstageDef).to.not.be.undefined;

      await FrontstageManager.setActiveFrontstageDef(frontstageDef);
      wrapper.update();
      expect(wrapper.find("li.nz-active").length).to.eq(1);
    });

    it("FrontstageLaunchBackstageItem updates on property change", async () => {
      const wrapper = mount(<FrontstageLaunchBackstageItem frontstageId="Test1" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" isEnabled={false} />);
      expect(wrapper.find("li.nz-disabled").length).to.eq(1);

      wrapper.setProps({ isEnabled: true });
      wrapper.update();
      expect(wrapper.find("li.nz-disabled").length).to.eq(0);
    });
  });
});
