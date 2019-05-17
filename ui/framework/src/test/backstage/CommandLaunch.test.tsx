/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import { expect } from "chai";
import * as sinon from "sinon";
import {
  CommandLaunchBackstageItem,
  FrontstageManager,
  BackstageItemState,
} from "../../ui-framework";
import TestUtils from "../TestUtils";
import { BackstageItem as NZ_BackstageItem } from "@bentley/ui-ninezone";
import { SyncUiEventDispatcher } from "../../ui-framework/syncui/SyncUiEventDispatcher";
import { Logger } from "@bentley/bentleyjs-core";

describe("Backstage", () => {
  const testEventId = "test-state-function-event";

  before(async () => {
    await TestUtils.initializeUiFramework();

    FrontstageManager.setActiveFrontstageDef(undefined); // tslint:disable-line:no-floating-promises
  });

  describe("<CommandLaunchBackstageItem />", () => {
    it("CommandLaunchBackstageItem should render & execute", () => {
      const spyMethod = sinon.stub();
      let stateFuncRun = false;
      const stateFunc = (state: Readonly<BackstageItemState>): BackstageItemState => {
        stateFuncRun = true;
        return { ...state, isEnabled: false } as BackstageItemState;
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
      wrapper.unmount();
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
      wrapper.unmount();
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

      wrapper.unmount();
      (Logger.logError as any).restore();
    });

    it("CommandLaunchBackstageItem renders correctly", () => {
      const commandHandler = () => { };
      const wrapper = shallow(<CommandLaunchBackstageItem commandId="my-command-id" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" execute={commandHandler} />);
      wrapper.should.matchSnapshot();
      wrapper.unmount();
    });
  });
});
