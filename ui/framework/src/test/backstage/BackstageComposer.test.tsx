/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import {
  Backstage as NZ_Backstage,
} from "@bentley/ui-ninezone";
import { BackstageItemsManager } from "@bentley/ui-abstract";
import {
  BackstageComposer,
  BackstageManager,
  UiFramework,
  useGroupedItems,
} from "../../ui-framework";
import { getActionItem, getStageLauncherItem } from "./BackstageComposerItem.test";
import { SinonSpy } from "../TestUtils";

describe("BackstageComposer", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should render", async () => {
    sandbox.stub(UiFramework, "backstageManager").get(() => new BackstageManager());
    shallow(<BackstageComposer />).should.matchSnapshot();
  });

  it("should close the backstage", async () => {
    const backstageManager = new BackstageManager();
    const spy = sandbox.spy(backstageManager, "close");
    sandbox.stub(UiFramework, "backstageManager").get(() => backstageManager);
    const sut = shallow(<BackstageComposer />);
    const backstage = sut.find(NZ_Backstage);

    backstage.prop("onClose")!();
    spy.calledOnceWithExactly().should.true;
  });

  it("should render backstage separators", async () => {
    const backstageManager = new BackstageManager();
    const items: BackstageManager["itemsManager"]["items"] = [
      getActionItem({ groupPriority: 200 }),
      getStageLauncherItem(),
    ];
    sandbox.stub(backstageManager.itemsManager, "items").get(() => items);
    sandbox.stub(UiFramework, "backstageManager").get(() => backstageManager);
    shallow(<BackstageComposer />).should.matchSnapshot();
  });
});

describe("useGroupedItems", () => {
  const manager = new BackstageItemsManager();
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  interface TestHookProps {
    renderItems: (items: ReturnType<typeof useGroupedItems>) => void;
  }

  // tslint:disable-next-line:variable-name
  const TestHook = (props: TestHookProps) => {
    const items = useGroupedItems(manager);
    props.renderItems(items);
    return null;
  };

  it("should omit invisible items", () => {
    const spy = sandbox.spy() as SinonSpy<TestHookProps["renderItems"]>;
    const items: BackstageManager["itemsManager"]["items"] = [
      getActionItem({ isVisible: false }),
    ];
    sandbox.stub(manager, "items").get(() => items);
    shallow(<TestHook renderItems={spy} />);

    spy.calledOnceWithExactly(sinon.match([])).should.true;
  });

  it("should group items by group priority", () => {
    const spy = sandbox.spy() as SinonSpy<TestHookProps["renderItems"]>;
    const items: BackstageManager["itemsManager"]["items"] = [
      getActionItem(),
      getStageLauncherItem(),
    ];
    sandbox.stub(manager, "items").get(() => items);
    shallow(<TestHook renderItems={spy} />);

    spy.calledOnceWithExactly(sinon.match([[
      items[0],
      items[1],
    ]])).should.true;
  });
});
