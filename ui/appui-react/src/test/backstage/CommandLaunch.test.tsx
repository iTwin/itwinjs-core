/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { Logger } from "@itwin/core-bentley";
import { BackstageItemState, CommandLaunchBackstageItem, FrontstageManager, SyncUiEventDispatcher } from "../../appui-react";
import TestUtils, { userEvent } from "../TestUtils";
import { render, screen } from "@testing-library/react";
import { MockRender } from "@itwin/core-frontend";

describe("Backstage", () => {
  const testEventId = "test-state-function-event";
  let theUserTo: ReturnType<typeof userEvent.setup>;
  beforeEach(()=>{
    theUserTo = userEvent.setup();
  });

  before(async () => {
    await TestUtils.initializeUiFramework();
    await MockRender.App.startup();

    await FrontstageManager.setActiveFrontstageDef(undefined);
  });

  after( async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiFramework();
  });

  describe("<CommandLaunchBackstageItem />", () => {
    it("CommandLaunchBackstageItem should render & execute", async () => {
      const spyMethod = sinon.stub();
      const stateFunc = sinon.fake((state: Readonly<BackstageItemState>): BackstageItemState => {
        return { ...state, isEnabled: false } as BackstageItemState;
      });
      render(
        <CommandLaunchBackstageItem commandId="my-command-id" labelKey="UiFramework:tests.label"
          descriptionKey="UiFramework:tests.subtitle" iconSpec="icon-placeholder" execute={spyMethod}
          stateSyncIds={[testEventId]} stateFunc={stateFunc} />,
      );

      expect(stateFunc).to.not.have.been.called;
      SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(testEventId);
      expect(stateFunc).to.have.been.called;

      await theUserTo.click(screen.getByRole("menuitem"));

      expect(spyMethod.calledOnce).to.be.true;
    });

    it("CommandLaunchBackstageItem should render & execute with args", async () => {
      const testExecute = sinon.spy();
      render(
        <CommandLaunchBackstageItem commandId="my-command-id" labelKey="UiFramework:tests.label"
          descriptionKey="UiFramework:tests.subtitle" iconSpec="icon-placeholder" execute={testExecute}
          getCommandArgs={() => (["arg1", "arg2"])}
        />,
      );

      await theUserTo.click(screen.getByRole("menuitem"));

      expect(testExecute).to.have.been.calledWith(["arg1", "arg2"]);
    });

    it("CommandLaunchBackstageItem should log error when no execute function provided", async () => {
      const spyMethod = sinon.spy(Logger, "logError");
      render(
        <CommandLaunchBackstageItem commandId="my-command-id" labelKey="UiFramework:tests.label"
          iconSpec="icon-placeholder" />,
      );

      await theUserTo.click(screen.getByRole("menuitem"));

      spyMethod.calledOnce.should.true;
    });

    it("CommandLaunchBackstageItem renders correctly", () => {
      const commandHandler = () => { };
      render(<CommandLaunchBackstageItem commandId="my-command-id" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" execute={commandHandler} />);

      expect(screen.getByRole("menuitem", {name: "tests.label"})).to.exist;
    });
  });
});
