/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import type {
  BackstageItem, UiItemsProvider} from "@itwin/appui-abstract";
import { BackstageItemsManager, BackstageItemUtilities, ConditionalBooleanValue, UiItemsManager,
} from "@itwin/appui-abstract";
import { Backstage as NZ_Backstage } from "@itwin/appui-layout-react";
import { BackstageComposer, BackstageComposerActionItem, BackstageComposerStageLauncher, BackstageManager, SyncUiEventDispatcher, UiFramework, useGroupedItems } from "../../appui-react";
import TestUtils, { mount } from "../TestUtils";
import { getActionItem, getStageLauncherItem } from "./BackstageComposerItem.test";
import { act, render } from "@testing-library/react";

const uiSyncEventId = "appuiprovider:backstage-item-visibility-changed";

const triggerSyncRefresh = () => {
  TestUiItemsProvider.sampleStatusVisible = false;
  SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(uiSyncEventId);
};

class TestUiItemsProvider implements UiItemsProvider {
  public readonly id = "BackstageComposer-TestUiProvider";
  public static sampleStatusVisible = true;

  constructor(public testWithDuplicate = false) { }

  public provideBackstageItems(): BackstageItem[] {
    const isHiddenItem = new ConditionalBooleanValue(() => !TestUiItemsProvider.sampleStatusVisible, [uiSyncEventId]);
    const items: BackstageItem[] = [];
    items.push(BackstageItemUtilities.createActionItem("UiItemsProviderTest:backstage1", 500, 50, () => { }, "Dynamic Action", undefined, "icon-addon"));
    items.push(BackstageItemUtilities.createActionItem("UiItemsProviderTest:backstage2", 600, 50, () => { }, "Dynamic Action", undefined, "icon-addon2", { isHidden: isHiddenItem }));
    items.push(BackstageItemUtilities.createActionItem("UiItemsProviderTest:backstage3", 600, 30, () => { }, "Dynamic Action", undefined, "icon-addon3"));
    this.testWithDuplicate && items.push(BackstageItemUtilities.createActionItem("UiItemsProviderTest:backstage3", 600, 30, () => { }, "Dynamic Action", undefined, "icon-addon3"));
    return items;
  }
}

describe("BackstageComposer", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("should render", async () => {
    sinon.stub(UiFramework, "backstageManager").get(() => new BackstageManager());
    shallow(<BackstageComposer items={[]} />).should.matchSnapshot();
  });

  it("should close the backstage", async () => {
    const backstageManager = new BackstageManager();
    const spy = sinon.spy(backstageManager, "close");
    sinon.stub(UiFramework, "backstageManager").get(() => backstageManager);
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

  it("should render single action item with hideSoloStageEntry set", async () => {
    const items: BackstageItem[] = [
      getActionItem({ groupPriority: 200 }),
      getStageLauncherItem(),
    ];
    const wrapper = render(<BackstageComposer hideSoloStageEntry items={items} />);
    expect(wrapper.container.querySelectorAll(".nz-backstage-item").length).equals(1);
    wrapper.rerender(<BackstageComposer items={items} />);
    expect(wrapper.container.querySelectorAll(".nz-backstage-item").length).equals(2);
  });

  it("should honor prop updates", async () => {
    const items: BackstageItem[] = [
      getActionItem({ groupPriority: 200 }),
      getStageLauncherItem(),
    ];
    const updatedItems: BackstageItem[] = [
      getStageLauncherItem(),
    ];

    const wrapper = mount(<BackstageComposer items={items} />);
    let actionItem = wrapper.find(BackstageComposerActionItem);
    expect(actionItem.exists()).to.be.true;
    let launchItem = wrapper.find(BackstageComposerStageLauncher);
    expect(launchItem.exists()).to.be.true;

    wrapper.setProps({ items: updatedItems });
    wrapper.update();
    actionItem = wrapper.find(BackstageComposerActionItem);
    expect(actionItem.exists()).to.be.false;
    launchItem = wrapper.find(BackstageComposerStageLauncher);
    expect(launchItem.exists()).to.be.true;
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

    act(() => UiItemsManager.register(uiProvider));

    await TestUtils.flushAsyncOperations();
    wrapper.update();
    addonItem = wrapper.find("i.icon-addon");
    expect(addonItem.exists()).to.be.true;
    let addonItem2 = wrapper.find("i.icon-addon2");
    expect(addonItem.exists()).to.be.true;

    act(() => triggerSyncRefresh());
    await TestUtils.flushAsyncOperations();
    wrapper.update();
    addonItem2 = wrapper.find("i.icon-addon2");
    expect(addonItem2.exists()).to.be.false;

    act(() => UiItemsManager.unregister(uiProvider.id));
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    addonItem = wrapper.find("i.icon-addon");
    expect(addonItem.exists()).to.be.false;
  });

  it("should filter out duplicate items", async () => {
    const items: BackstageItem[] = [
      getActionItem({ groupPriority: 200 }),
      getStageLauncherItem(),
      getStageLauncherItem(),
    ];

    const uiProvider = new TestUiItemsProvider(true);
    const wrapper = mount(<BackstageComposer items={items} />);
    expect(wrapper.find("li[data-item-type='backstage-item']")).to.have.lengthOf(2);

    let addonItem = wrapper.find("i.icon-addon");
    expect(addonItem.exists()).to.be.false;

    act(() => UiItemsManager.register(uiProvider));
    await TestUtils.flushAsyncOperations();
    wrapper.update();
    addonItem = wrapper.find("i.icon-addon");
    expect(addonItem.exists()).to.be.true;
    let addonItem2 = wrapper.find("i.icon-addon2");
    expect(addonItem.exists()).to.be.true;
    expect(wrapper.find("li[data-item-type='backstage-item']")).to.have.lengthOf(4);

    act(() => triggerSyncRefresh());
    await TestUtils.flushAsyncOperations();
    wrapper.update();
    addonItem2 = wrapper.find("i.icon-addon2");
    expect(addonItem2.exists()).to.be.false;
    act(() => UiItemsManager.unregister(uiProvider.id));
    await TestUtils.flushAsyncOperations();
    wrapper.update();
    addonItem = wrapper.find("i.icon-addon");
    expect(addonItem.exists()).to.be.false;
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

    act(() => triggerSyncRefresh());
    await TestUtils.flushAsyncOperations();
    wrapper.update();
    addonItem2 = wrapper.find("i.icon-addon2");
    expect(addonItem2.exists()).to.be.false;

    act(() => UiItemsManager.unregister(uiProvider.id));
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    addonItem = wrapper.find("i.icon-addon");
    expect(addonItem.exists()).to.be.false;
  });

  describe("useGroupedItems", () => {
    const itemsManager = new BackstageItemsManager();

    interface TestHookProps {
      renderItems: (items: ReturnType<typeof useGroupedItems>) => void;
    }

    // eslint-disable-next-line @typescript-eslint/naming-convention
    const TestHook = (props: TestHookProps) => {
      const items = useGroupedItems(itemsManager.items);
      props.renderItems(items);
      return null;
    };

    it("should omit invisible items", () => {
      const spy = sinon.stub<TestHookProps["renderItems"]>();
      const items = [
        getActionItem({ isHidden: true }),
      ];
      itemsManager.items = items;
      shallow(<TestHook renderItems={spy} />);

      spy.calledOnceWithExactly(sinon.match([])).should.true;
    });

    it("should group items by group priority", () => {
      const spy = sinon.stub<TestHookProps["renderItems"]>();
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
