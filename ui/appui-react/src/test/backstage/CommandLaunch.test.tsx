/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { Logger } from "@itwin/core-bentley";
import { BackstageItem as NZ_BackstageItem } from "@itwin/appui-layout-react";
import { BackstageItemState, CommandLaunchBackstageItem, FrontstageManager, SyncUiEventDispatcher } from "../../appui-react";
import TestUtils, { mount } from "../TestUtils";

describe("Backstage", () => {
  const testEventId = "test-state-function-event";

  before(async () => {
    await TestUtils.initializeUiFramework();

    await FrontstageManager.setActiveFrontstageDef(undefined);
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  describe("<CommandLaunchBackstageItem />", () => {
    it("CommandLaunchBackstageItem should render & execute", () => {
      const spyMethod = sinon.stub();
      let stateFuncRun = false;
      const stateFunc = (state: Readonly<BackstageItemState>): BackstageItemState => { // eslint-disable-line deprecation/deprecation
        stateFuncRun = true;
        return { ...state, isEnabled: false } as BackstageItemState; // eslint-disable-line deprecation/deprecation
      };
      const wrapper = mount(
        <CommandLaunchBackstageItem commandId="my-command-id" labelKey="UiFramework:tests.label"
          descriptionKey="UiFramework:tests.subtitle" iconSpec="icon-placeholder" execute={spyMethod}
          stateSyncIds={[testEventId]} stateFunc={stateFunc} />,
      );

      expect(stateFuncRun).to.be.false;
      SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(testEventId);
      expect(stateFuncRun).to.be.true;

      const backstageItem = wrapper.find(NZ_BackstageItem);
      backstageItem.find(".nz-backstage-item").simulate("click");
      expect(spyMethod.calledOnce).to.be.true;
    });

    it("CommandLaunchBackstageItem should render & execute with args", () => {
      let argsPassed = false;
      const testExecute = (args: any) => { if (args) argsPassed = true; };
      const wrapper = mount(
        <CommandLaunchBackstageItem commandId="my-command-id" labelKey="UiFramework:tests.label"
          descriptionKey="UiFramework:tests.subtitle" iconSpec="icon-placeholder" execute={testExecute}
          getCommandArgs={() => (["arg1", "arg2"])}
        />,
      );

      expect(argsPassed).to.be.false;
      const backstageItem = wrapper.find(NZ_BackstageItem);
      backstageItem.find(".nz-backstage-item").simulate("click");
      expect(argsPassed).to.be.true;
    });

    it("CommandLaunchBackstageItem should log error when no execute function provided", () => {
      const spyMethod = sinon.spy(Logger, "logError");
      const wrapper = mount(
        <CommandLaunchBackstageItem commandId="my-command-id" labelKey="UiFramework:tests.label"
          iconSpec="icon-placeholder" />,
      );

      const backstageItem = wrapper.find(NZ_BackstageItem);
      backstageItem.find(".nz-backstage-item").simulate("click");
      spyMethod.calledOnce.should.true;
    });

    it("CommandLaunchBackstageItem renders correctly", () => {
      const commandHandler = () => { };
      const wrapper = shallow(<CommandLaunchBackstageItem commandId="my-command-id" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" execute={commandHandler} />);
      wrapper.should.matchSnapshot();
    });
  });
});
