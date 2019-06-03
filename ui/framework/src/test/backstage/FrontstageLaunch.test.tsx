/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import { expect } from "chai";
import * as sinon from "sinon";
import {
  FrontstageLaunchBackstageItem,
  FrontstageManager,
  FrontstageActivatedEventArgs,
  ConfigurableUiManager,
  FrontstageProvider,
  Frontstage,
  FrontstageProps,
  BackstageItemState,
} from "../../ui-framework";
import TestUtils from "../TestUtils";
import { BackstageItem as NZ_BackstageItem } from "@bentley/ui-ninezone";
import { CoreTools } from "../../ui-framework/CoreToolDefinitions";
import { SyncUiEventDispatcher } from "../../ui-framework/syncui/SyncUiEventDispatcher";
import { Logger } from "@bentley/bentleyjs-core";

describe("Backstage", () => {
  const testEventId = "test-state-function-event";

  before(async () => {
    await TestUtils.initializeUiFramework();

    FrontstageManager.setActiveFrontstageDef(undefined); // tslint:disable-line:no-floating-promises
  });

  describe("<FrontstageLaunchBackstageItem />", () => {
    it("FrontstageLaunchBackstageItem should render & execute", async () => {
      const spyMethod = sinon.stub();
      let stateFuncRun = false;
      const stateFunc = (state: Readonly<BackstageItemState>): BackstageItemState => {
        stateFuncRun = true;
        return { ...state, isActive: true } as BackstageItemState;
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
