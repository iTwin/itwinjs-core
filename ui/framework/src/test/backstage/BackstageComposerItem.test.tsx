/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { BackstageItem as NZ_BackstageItem } from "@bentley/ui-ninezone";
import {
  BackstageComposerActionItem,
  BackstageComposerStageLauncher,
  UiFramework,
  BackstageManager,
  BackstageComposerItem,
  FrontstageManager,
  BackstageItemType,
  BackstageActionItem, BackstageStageLauncher,
} from "../../ui-framework";
import { FrontstageDef } from "../../ui-framework/frontstage/FrontstageDef";
import TestUtils from "../TestUtils";

// tslint:disable-next-line: completed-docs
export const getActionItem = (item?: Partial<BackstageActionItem>): BackstageActionItem => ({ // tslint:disable-line:deprecation
  execute: () => { },
  groupPriority: 100,
  id: "Action",
  itemPriority: 50,
  label: "Custom Label",
  type: BackstageItemType.ActionItem, // tslint:disable-line:deprecation
  ...item ? item : {},
});

// tslint:disable-next-line: completed-docs
export const getStageLauncherItem = (item?: Partial<BackstageStageLauncher>): BackstageStageLauncher => ({ // tslint:disable-line:deprecation
  groupPriority: 100,
  id: "Stage",
  itemPriority: 50,
  label: "Custom Label",
  stageId: "stage-1",
  type: BackstageItemType.StageLauncher, // tslint:disable-line:deprecation
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
    const sandbox = sinon.createSandbox();

    afterEach(() => {
      sandbox.restore();
    });

    it("should render", async () => {
      sandbox.stub(UiFramework, "backstageManager").get(() => new BackstageManager());
      shallow(<BackstageComposerStageLauncher item={getStageLauncherItem()} />).should.matchSnapshot();
    });

    it("should activate frontstage def", async () => {
      const backstageManager = new BackstageManager();
      sandbox.stub(UiFramework, "backstageManager").get(() => backstageManager);
      const sut = shallow(<BackstageComposerStageLauncher item={getStageLauncherItem({ stageId: "Frontstage-1" })} />);
      const backstageItem = sut.find(NZ_BackstageItem);

      const frontstageDef = new FrontstageDef();
      sandbox.stub(FrontstageManager, "findFrontstageDef").withArgs("Frontstage-1").returns(frontstageDef);
      const spy = sandbox.stub(FrontstageManager, "setActiveFrontstageDef").returns(Promise.resolve());
      backstageItem.prop("onClick")!();

      spy.calledOnceWithExactly(frontstageDef).should.true;
    });

    it("should not activate if frontstage def is not found", async () => {
      const backstageManager = new BackstageManager();
      sandbox.stub(UiFramework, "backstageManager").get(() => backstageManager);
      const sut = shallow(<BackstageComposerStageLauncher item={getStageLauncherItem()} />);
      const backstageItem = sut.find(NZ_BackstageItem);

      sandbox.stub(FrontstageManager, "findFrontstageDef").returns(undefined);
      const spy = sandbox.spy(FrontstageManager, "setActiveFrontstageDef");
      backstageItem.prop("onClick")!();

      spy.notCalled.should.true;
    });
  });

  describe("BackstageComposerItem", () => {
    it("should render stage launcher", async () => {
      shallow(<BackstageComposerItem item={getStageLauncherItem()} />).should.matchSnapshot();
    });

    it("should render action item", async () => {
      shallow(<BackstageComposerItem item={getActionItem()} />).should.matchSnapshot();
    });
  });

});
