/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { BackstageItem as NZ_BackstageItem } from "@itwin/appui-layout-react";
import type {
  BackstageActionItem,
  BackstageStageLauncher} from "../../appui-react";
import { BackstageComposerActionItem, BackstageComposerItem, BackstageComposerStageLauncher, BackstageItemType, BackstageManager, FrontstageManager, UiFramework,
} from "../../appui-react";
import TestUtils, { mount } from "../TestUtils";
import { BadgeType } from "@itwin/appui-abstract";

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
  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  describe("BackstageComposerActionItem", () => {
    it("should render", () => {
      shallow(<BackstageComposerActionItem item={getActionItem()} />).should.matchSnapshot();
    });

    it("should invoke execute", () => {
      const spyExecute = sinon.fake();
      const actionItem = getActionItem({ execute: spyExecute });
      const sut = shallow(<BackstageComposerActionItem item={actionItem} />);
      const backstageItem = sut.find(NZ_BackstageItem);
      backstageItem.prop("onClick")!();
      spyExecute.calledOnce.should.true;
    });
  });

  describe("BackstageComposerStageLauncher", () => {
    it("should render", async () => {
      sinon.stub(UiFramework, "backstageManager").get(() => new BackstageManager());
      shallow(<BackstageComposerStageLauncher item={getStageLauncherItem()} />).should.matchSnapshot();
    });

    it("should activate frontstage", async () => {
      const backstageManager = new BackstageManager();
      sinon.stub(UiFramework, "backstageManager").get(() => backstageManager);
      const sut = shallow(<BackstageComposerStageLauncher item={getStageLauncherItem({ stageId: "Frontstage-1" })} />);
      const backstageItem = sut.find(NZ_BackstageItem);

      sinon.stub(FrontstageManager, "hasFrontstage").withArgs("Frontstage-1").returns(true);
      const spy = sinon.stub(FrontstageManager, "setActiveFrontstage");
      backstageItem.prop("onClick")!();
      await TestUtils.flushAsyncOperations();
      spy.calledOnceWithExactly("Frontstage-1").should.true;
    });

    it("should not activate if frontstage is not found", async () => {
      const backstageManager = new BackstageManager();
      sinon.stub(UiFramework, "backstageManager").get(() => backstageManager);
      const sut = shallow(<BackstageComposerStageLauncher item={getStageLauncherItem()} />);
      const backstageItem = sut.find(NZ_BackstageItem);
      sinon.stub(FrontstageManager, "hasFrontstage").withArgs("stage-1").returns(false);
      const spy = sinon.stub(FrontstageManager, "setActiveFrontstage");
      backstageItem.prop("onClick")!();

      spy.notCalled.should.true;
    });

    it("should honor isActive prop override", () => {
      const backstageManager = new BackstageManager();
      sinon.stub(UiFramework, "backstageManager").get(() => backstageManager);
      const sut = shallow(<BackstageComposerStageLauncher item={getStageLauncherItem({ isActive: true })} />);
      const backstageItem = sut.find(NZ_BackstageItem);

      backstageItem.prop("isActive")!.should.true;
    });
  });

  describe("BackstageComposerItem", () => {
    it("should render stage launcher", async () => {
      shallow(<BackstageComposerItem item={getStageLauncherItem()} />).should.matchSnapshot();
    });

    it("should render action item", async () => {
      shallow(<BackstageComposerItem item={getActionItem()} />).should.matchSnapshot();
    });

    it("should render with badgeType", async () => {
      shallow(<BackstageComposerItem item={getActionItem({ badgeType: BadgeType.TechnicalPreview })} />).should.matchSnapshot();
    });

    it("renders stage launcher with badge correctly", () => {
      const sut = mount(<BackstageComposerItem item={getStageLauncherItem({ badgeType: BadgeType.TechnicalPreview })} />);
      const badge = sut.find("div.nz-badge");
      badge.length.should.eq(1);
    });

    it("renders action item with badge correctly", () => {
      const sut = mount(<BackstageComposerItem item={getActionItem({ badgeType: BadgeType.TechnicalPreview })} />);
      const badge = sut.find("div.nz-badge");
      badge.length.should.eq(1);
    });

  });

});
