/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow, mount } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { expect } from "chai";

import {
  Backstage as NZ_Backstage,
} from "@bentley/ui-ninezone";
import { BackstageItem, UiItemsProvider, BackstageItemUtilities, UiItemsManager, BackstageItemsManager, ConditionalBooleanValue } from "@bentley/ui-abstract";
import {
  BackstageComposer,
  BackstageManager,
  UiFramework,
  useGroupedItems,
  SyncUiEventDispatcher,
} from "../../ui-framework";
import { getActionItem, getStageLauncherItem } from "./BackstageComposerItem.test";
import TestUtils from "../TestUtils";

const uiSyncEventId = "appuiprovider:backstage-item-visibility-changed";

const triggerSyncRefresh = () => {
  TestUiItemsProvider.sampleStatusVisible = false;
  SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(uiSyncEventId);
};

class TestUiItemsProvider implements UiItemsProvider {
  public readonly id = "BackstageComposer-TestUiProvider";
  public static sampleStatusVisible = true;

  public provideBackstageItems(): BackstageItem[] {
    const isHiddenItem = new ConditionalBooleanValue(() => !TestUiItemsProvider.sampleStatusVisible, [uiSyncEventId]);

    return [
      BackstageItemUtilities.createActionItem("UiItemsProviderTest:backstage1", 500, 50, () => { }, "Dynamic Action", undefined, "icon-addon"),
      BackstageItemUtilities.createActionItem("UiItemsProviderTest:backstage2", 600, 50, () => { }, "Dynamic Action", undefined, "icon-addon2", { isHidden: isHiddenItem }),
      BackstageItemUtilities.createActionItem("UiItemsProviderTest:backstage3", 600, 30, () => { }, "Dynamic Action", undefined, "icon-addon3"),
    ];
  }
}

describe("BackstageComposer", () => {
  const sandbox = sinon.createSandbox();

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should render", async () => {
    sandbox.stub(UiFramework, "backstageManager").get(() => new BackstageManager());
    shallow(<BackstageComposer items={[]} />).should.matchSnapshot();
  });

  it("should close the backstage", async () => {
    const backstageManager = new BackstageManager();
    const spy = sandbox.spy(backstageManager, "close");
    sandbox.stub(UiFramework, "backstageManager").get(() => backstageManager);
    const sut = shallow(<BackstageComposer items={[]} />);
    const backstage = sut.find(NZ_Backstage);

    backstage.prop("onClose")!();
    spy.calledOnceWithExactly().should.true;
  });

  it("should render backstage separators", async () => {
    const items: BackstageItem[] = [
      getActionItem({ groupPriority: 200 }),
      getStageLauncherItem(),
    ];
    shallow(<BackstageComposer items={items} />).should.matchSnapshot();
  });

  it("should honor addon items", async () => {
    const items: BackstageItem[] = [
      getActionItem({ groupPriority: 200 }),
      getStageLauncherItem(),
    ];

    const uiProvider = new TestUiItemsProvider();
    expect(items.length).to.eq(2);

    const wrapper = mount(<BackstageComposer items={items} />);

    let addonItem = wrapper.find("i.icon-addon");
    expect(addonItem.exists()).to.be.false;

    UiItemsManager.register(uiProvider);

    await TestUtils.flushAsyncOperations();
    wrapper.update();
    addonItem = wrapper.find("i.icon-addon");
    expect(addonItem.exists()).to.be.true;
    let addonItem2 = wrapper.find("i.icon-addon2");
    expect(addonItem.exists()).to.be.true;

    triggerSyncRefresh();
    await TestUtils.flushAsyncOperations();
    wrapper.update();
    addonItem2 = wrapper.find("i.icon-addon2");
    expect(addonItem2.exists()).to.be.false;

    UiItemsManager.unregister(uiProvider.id);
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    // tslint:disable-next-line: no-console
    // console.log(wrapper.debug());

    addonItem = wrapper.find("i.icon-addon");
    expect(addonItem.exists()).to.be.false;

    wrapper.unmount();
  });

  it("should honor items from addons loaded before component", async () => {
    const items: BackstageItem[] = [
      getActionItem({ groupPriority: 200 }),
      getStageLauncherItem(),
    ];

    const uiProvider = new TestUiItemsProvider();
    expect(items.length).to.eq(2);

    UiItemsManager.register(uiProvider);

    const wrapper = mount(<BackstageComposer items={items} />);

    await TestUtils.flushAsyncOperations();
    let addonItem = wrapper.find("i.icon-addon");
    expect(addonItem.exists()).to.be.true;
    let addonItem2 = wrapper.find("i.icon-addon2");
    expect(addonItem.exists()).to.be.true;

    triggerSyncRefresh();
    await TestUtils.flushAsyncOperations();
    wrapper.update();
    addonItem2 = wrapper.find("i.icon-addon2");
    expect(addonItem2.exists()).to.be.false;

    UiItemsManager.unregister(uiProvider.id);
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    // tslint:disable-next-line: no-console
    // console.log(wrapper.debug());

    addonItem = wrapper.find("i.icon-addon");
    expect(addonItem.exists()).to.be.false;

    wrapper.unmount();
  });

  describe("useGroupedItems", () => {
    const itemsManager = new BackstageItemsManager();
    const hooksSandbox = sinon.createSandbox();

    afterEach(() => {
      hooksSandbox.restore();
    });

    interface TestHookProps {
      renderItems: (items: ReturnType<typeof useGroupedItems>) => void;
    }

    // tslint:disable-next-line:variable-name
    const TestHook = (props: TestHookProps) => {
      const items = useGroupedItems(itemsManager.items);
      props.renderItems(items);
      return null;
    };

    it("should omit invisible items", () => {
      const spy = hooksSandbox.stub<TestHookProps["renderItems"]>();
      const items = [
        getActionItem({ isHidden: true }),
      ];
      itemsManager.items = items;
      shallow(<TestHook renderItems={spy} />);

      spy.calledOnceWithExactly(sinon.match([])).should.true;
    });

    it("should group items by group priority", () => {
      const spy = hooksSandbox.stub<TestHookProps["renderItems"]>();
      const items = [
        getActionItem(),
        getStageLauncherItem(),
      ];
      itemsManager.items = items;
      shallow(<TestHook renderItems={spy} />);

      spy.calledOnceWithExactly(sinon.match([[
        items[0],
        items[1],
      ]])).should.true;
    });
  });
});
