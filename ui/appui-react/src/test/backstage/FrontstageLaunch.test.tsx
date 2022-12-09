/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { Logger } from "@itwin/core-bentley";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import {
  BackstageItemState, ConfigurableUiManager, CoreTools, Frontstage, FrontstageLaunchBackstageItem, FrontstageManager,
  FrontstageProps, FrontstageProvider, SyncUiEventDispatcher,
} from "../../appui-react";
import TestUtils, { selectorMatches, userEvent } from "../TestUtils";
import { render, screen } from "@testing-library/react";
import { EmptyLocalization } from "@itwin/core-common";

describe("Backstage", () => {
  const testEventId = "test-state-function-event";
  let theUserTo: ReturnType<typeof userEvent.setup>;
  beforeEach(async ()=>{
    theUserTo = userEvent.setup();
    await FrontstageManager.setActiveFrontstageDef(undefined);
  });

  before(async () => {
    await TestUtils.initializeUiFramework();
    await NoRenderApp.startup({ localization: new EmptyLocalization() });
    class Frontstage1 extends FrontstageProvider {
      public static stageId = "Test1";
      public get id(): string {
        return Frontstage1.stageId;
      }

      public get frontstage(): React.ReactElement<FrontstageProps> {
        return (
          <Frontstage
            id={this.id}
            defaultTool={CoreTools.selectElementCommand}
            contentGroup={TestUtils.TestContentGroup1}
          />
        );
      }
    }
    ConfigurableUiManager.addFrontstageProvider(new Frontstage1());
  });

  after(async () => {
    TestUtils.terminateUiFramework();
    await IModelApp.shutdown();
  });

  describe("<FrontstageLaunchBackstageItem />", () => {
    it("FrontstageLaunchBackstageItem should render & execute", async () => {
      const stateFunc = sinon.fake((state: Readonly<BackstageItemState>): BackstageItemState => {
        return { ...state, isActive: true } as BackstageItemState;
      });

      const spy = sinon.spy(FrontstageManager.onFrontstageActivatedEvent, "emit");
      render(
        <FrontstageLaunchBackstageItem frontstageId={"Test1"} labelKey="UiFramework:tests.label" iconSpec="icon-placeholder"
          isEnabled={true} isActive={false}
          stateSyncIds={[testEventId]} stateFunc={stateFunc} />,
      );

      expect(stateFunc).not.to.have.been.called;
      SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(testEventId);
      expect(stateFunc).to.have.been.called;

      await theUserTo.click(screen.getByRole("menuitem"));
      expect(spy.calledOnce).to.be.true;
    });

    it("FrontstageLaunchBackstageItem should log error when invalid frontstageId is provided", async () => {
      const spyMethod = sinon.spy(Logger, "logError");
      render(
        <FrontstageLaunchBackstageItem frontstageId="BadTest" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" />,
      );

      await theUserTo.click(screen.getByRole("menuitem"));
      spyMethod.calledOnce.should.true;
    });

    it("FrontstageLaunchBackstageItem renders correctly when inactive", async () => {
      render(<FrontstageLaunchBackstageItem frontstageId="Test1" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" />);

      expect(screen.getByRole("menuitem", {name: "tests.label"})).not.to.satisfy(selectorMatches(".nz-active"));
    });

    it("FrontstageLaunchBackstageItem renders correctly when active", async () => {
      await FrontstageManager.setActiveFrontstage("Test1");
      render(<FrontstageLaunchBackstageItem frontstageId="Test1" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" />);

      expect(screen.getByRole("menuitem", {name: "tests.label"})).to.satisfy(selectorMatches(".nz-active"));
    });

    it("FrontstageLaunchBackstageItem updates on frontstage activation", async () => {
      render(<FrontstageLaunchBackstageItem frontstageId="Test1" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" />);

      await FrontstageManager.setActiveFrontstage("Test1");
      expect(screen.getByRole("menuitem", {name: "tests.label"})).to.satisfy(selectorMatches(".nz-active"));
    });

    it("FrontstageLaunchBackstageItem updates on property change", async () => {
      const {rerender} = render(<FrontstageLaunchBackstageItem frontstageId="Test1" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" isEnabled={false} />);
      expect(screen.getByRole("menuitem")).to.satisfy(selectorMatches(".nz-disabled"));

      rerender(<FrontstageLaunchBackstageItem frontstageId="Test1" labelKey="UiFramework:tests.label" iconSpec="icon-placeholder" isEnabled={true} />);

      expect(screen.getByRole("menuitem")).not.to.satisfy(selectorMatches(".nz-disabled"));
    });
  });
});
