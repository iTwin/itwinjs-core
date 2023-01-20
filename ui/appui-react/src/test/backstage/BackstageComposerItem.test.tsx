/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import {
  BackstageActionItem, BackstageComposerActionItem, BackstageComposerItem, BackstageComposerStageLauncher, BackstageItemType,
  BackstageStageLauncher, UiFramework,
} from "../../appui-react";
import TestUtils, { childStructure, selectorMatches, userEvent } from "../TestUtils";
import { BadgeType } from "@itwin/appui-abstract";
import { render, screen } from "@testing-library/react";
import { expect } from "chai";

/** @internal */
export const getActionItem = (item?: Partial<BackstageActionItem>): BackstageActionItem => ({ // eslint-disable-line deprecation/deprecation
  execute: () => { },
  groupPriority: 100,
  id: "Action",
  itemPriority: 50,
  label: "Custom Label",
  type: BackstageItemType.ActionItem, // eslint-disable-line deprecation/deprecation
  ...item ? item : {},
});

/** @internal */
export const getStageLauncherItem = (item?: Partial<BackstageStageLauncher>): BackstageStageLauncher => ({ // eslint-disable-line deprecation/deprecation
  groupPriority: 100,
  id: "Stage",
  itemPriority: 50,
  label: "Custom Label",
  stageId: "stage-1",
  type: BackstageItemType.StageLauncher, // eslint-disable-line deprecation/deprecation
  ...item ? item : {},
});

describe("BackstageComposerItem", () => {
  let theUserTo: ReturnType<typeof userEvent.setup>;
  beforeEach(()=>{
    theUserTo = userEvent.setup();
  });

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  describe("BackstageComposerActionItem", () => {
    it("should render", () => {
      render(<BackstageComposerActionItem item={getActionItem()} />);

      expect(screen.getByRole("menuitem", {name: "Custom Label"})).to.satisfy(selectorMatches("li.nz-backstage-item"));
    });

    it("should invoke execute", async () => {
      const spyExecute = sinon.fake();
      const actionItem = getActionItem({ execute: spyExecute });
      render(<BackstageComposerActionItem item={actionItem} />);

      await theUserTo.click(screen.getByRole("menuitem"));

      spyExecute.calledOnce.should.true;
    });
  });

  describe("BackstageComposerStageLauncher", () => {
    it("should render", async () => {
      render(<BackstageComposerStageLauncher item={getStageLauncherItem()} />);

      expect(screen.getByRole("menuitem", {name: "Custom Label"})).to.satisfy(selectorMatches("li.nz-backstage-item"));
    });

    it("should activate frontstage", async () => {
      sinon.stub(UiFramework.frontstages, "hasFrontstage").withArgs("Frontstage-1").returns(true);
      const spy = sinon.stub(UiFramework.frontstages, "setActiveFrontstage");

      render(<BackstageComposerStageLauncher item={getStageLauncherItem({ stageId: "Frontstage-1" })} />);

      await theUserTo.click(screen.getByRole("menuitem"));
      spy.calledOnceWithExactly("Frontstage-1").should.true;
    });

    it("should not activate if frontstage is not found", async () => {
      const spy = sinon.stub(UiFramework.frontstages, "setActiveFrontstage");

      render(<BackstageComposerStageLauncher item={getStageLauncherItem()} />);
      await theUserTo.click(screen.getByRole("menuitem"));

      spy.notCalled.should.true;
    });

    it("should honor isActive prop override", () => {
      render(<BackstageComposerStageLauncher item={getStageLauncherItem({ isActive: true })} />);

      expect(screen.getByRole("menuitem", {name: "Custom Label"})).to.satisfy(selectorMatches("li.nz-backstage-item.nz-active"));
    });
  });

  describe("BackstageComposerItem", () => {
    it("should render stage launcher", async () => {
      const spy = sinon.spy(UiFramework.frontstages, "setActiveFrontstage");
      sinon.stub(UiFramework.frontstages, "hasFrontstage").returns(true);
      render(<BackstageComposerItem item={getStageLauncherItem()} />);

      await theUserTo.click(screen.getByRole("menuitem"));

      expect(spy).to.have.been.called;
    });

    it("should render action item", async () => {
      const spy = sinon.spy();
      render(<BackstageComposerItem item={getActionItem({execute: spy})} />);

      await theUserTo.click(screen.getByRole("menuitem"));

      expect(spy).to.have.been.called;
    });

    it("should render with TP badgeType", async () => {
      render(<BackstageComposerItem item={getActionItem({ badgeType: BadgeType.TechnicalPreview })} />);

      expect(screen.getByRole("menuitem")).to.satisfy(childStructure(".nz-badge .core-badge-betaBadge"));
    });

    it("should render with New badgeType", async () => {
      render(<BackstageComposerItem item={getStageLauncherItem({ badgeType: BadgeType.New })} />);

      expect(screen.getByRole("menuitem")).to.satisfy(childStructure(".nz-badge .core-new-badge"));
    });
  });

});
