/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import { expect } from "chai";
import * as sinon from "sinon";
import {
  BackstageComposer,
  CommandLaunchBackstageItem,
  Backstage,
  FrontstageManager,
  SyncUiEventDispatcher,
  BackstageItemManager,
  BackstageItemProvider,
  BackstageItemSpec,
  ConditionalDisplayType,
  CustomItemSpec,
} from "../../ui-framework";
import TestUtils, { MockAccessToken } from "../TestUtils";

const spyMethod = sinon.spy();
let visibilityTestFuncCalled = false;
let testPropertyValue = true;

// cSpell:ignore settestproperty
class TestBackstageItemProvider implements BackstageItemProvider {
  /** id of provider */
  public readonly id = "ui-test-app.AppBackstageItemProvider";

  public provideBackstageItems(): BackstageItemSpec[] {
    const backstageItems: BackstageItemSpec[] = [];
    backstageItems.push(BackstageItemManager.createFrontstageLauncherItemSpec("Test1", 100, 10, "TestApp:backstage.testFrontstage1", undefined, undefined, "icon-placeholder"));
    backstageItems.push(BackstageItemManager.createFrontstageLauncherItemSpec("Test2", 100, 20, "TestApp:backstage.testFrontstage2", undefined, undefined, "icon-placeholder"));
    const stage3Item = BackstageItemManager.createFrontstageLauncherItemSpec("Test3", 100, 30, "TestApp:backstage.testFrontstage3", undefined, undefined, "icon-placeholder");
    stage3Item.condition = {
      type: ConditionalDisplayType.Visibility,
      testFunc: (): boolean => { visibilityTestFuncCalled = true; return testPropertyValue; },
      syncEventIds: ["test-action-settestproperty"],
    };
    backstageItems.push(stage3Item);
    const stage4Item = BackstageItemManager.createFrontstageLauncherItemSpec("Test4", 100, 40, "TestApp:backstage.testFrontstage4", undefined, undefined, "icon-placeholder");
    stage4Item.condition = {
      type: ConditionalDisplayType.EnableState,
      testFunc: (): boolean => testPropertyValue,
      syncEventIds: ["test-action-settestproperty"],
    };
    backstageItems.push(stage4Item);
    backstageItems.push(BackstageItemManager.createFrontstageLauncherItemSpec("IModelOpen", 200, 10, "TestApp:backstage.imodelopen", undefined, undefined, "icon-folder-opened"));
    backstageItems.push(BackstageItemManager.createCommandLauncherItemSpec("IModelIndex", 200, 20, () => { }, "TestApp:teat.label", undefined, undefined, "icon-placeholder"));
    backstageItems.push(BackstageItemManager.createCommandLauncherItemSpec("CmdTest", 200, 20, () => { }, "TestApp:teat.label", "TestApp:subtitle", "TestApp:tool-tip", "icon-placeholder"));
    backstageItems.push(BackstageItemManager.createFrontstageLauncherItemSpec("ViewsFrontstage", 400, 10, "TestApp:backstage.viewIModel", "TestApp:backstage.iModelStage", "TestApp:backstage.tooltip", "icon-placeholder"));

    backstageItems.push(BackstageItemManager.createCustomBackstageItemSpec(this.id, "custom-test", 500, 10, "TestApp:backstage.custom", "TestApp:subtitle", "TestApp:tool-tip", "TestApp:icon"));
    backstageItems.push(BackstageItemManager.createCustomBackstageItemSpec("CustomTest", "custom-test", 500, 10, "TestApp:backstage.custom", undefined, undefined, "TestApp:icon"));

    return backstageItems;
  }

  private _processCustomItem = (_itemId: string) => {
    spyMethod();
  }

  public provideCustomBackstageItem(itemSpec: CustomItemSpec): React.ReactNode {
    if (itemSpec.customItemProviderId !== this.id || "custom-test" !== itemSpec.itemId)
      return null;

    return <CommandLaunchBackstageItem iconSpec={itemSpec.icon} commandId={itemSpec.itemId} execute={() => this._processCustomItem(itemSpec.itemId)}
      label={itemSpec.label} description={itemSpec.subtitle} tooltip={itemSpec.toolTip} key={itemSpec.itemId} />;
  }
}

let testBackstageItemProvider: TestBackstageItemProvider | undefined;

describe("BackstageComposer", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
    testBackstageItemProvider = new TestBackstageItemProvider();
    BackstageItemManager.register(testBackstageItemProvider);
    FrontstageManager.setActiveFrontstageDef(undefined); // tslint:disable-line:no-floating-promises
    SyncUiEventDispatcher.initialize();   // To process BackstageComposer events
  });

  after(() => {
    BackstageItemManager.unregister(testBackstageItemProvider!.id);
    TestUtils.terminateUiFramework();
  });

  it("should render - isVisible", () => {
    const wrapper = mount(<BackstageComposer isVisible={true} />);
    wrapper.unmount();
  });

  it("should render - !isVisible", () => {
    const wrapper = mount(<BackstageComposer isVisible={false} />);
    wrapper.unmount();
  });

  it("renders correctly - isVisible", () => {
    shallow(<BackstageComposer isVisible={true} />).should.matchSnapshot();
  });

  it("renders correctly - !isVisible", () => {
    shallow(<BackstageComposer isVisible={false} />).should.matchSnapshot();
  });

  it("renders correctly with header", () => {
    shallow(<BackstageComposer header={<div> Hello World! </div>} />).should.matchSnapshot();
  });

  it("renders correctly with AccessToken", () => {
    shallow(<BackstageComposer accessToken={new MockAccessToken()} />).should.matchSnapshot();
  });

  it("should show by updating isVisible prop", () => {
    const wrapper = mount(<BackstageComposer isVisible={false} />);
    expect(Backstage.isBackstageVisible).to.be.false;
    wrapper.setProps({ isVisible: true });
    expect(Backstage.isBackstageVisible).to.be.true;
    wrapper.unmount();
  });

  it("should close when clicking the overlay", () => {
    spyMethod.resetHistory();
    const wrapper = mount(<BackstageComposer isVisible={true} onClose={spyMethod} />);
    expect(Backstage.isBackstageVisible).to.be.true;
    const overlay = wrapper.find("div.nz-backstage-backstage_overlay");
    overlay.simulate("click");
    expect(Backstage.isBackstageVisible).to.be.false;
    expect(spyMethod.calledOnce).to.be.true;
    wrapper.unmount();
  });

  it("should handle sync events", () => {
    const wrapper = mount(<BackstageComposer isVisible={true} />);
    visibilityTestFuncCalled = false;
    testPropertyValue = false;
    SyncUiEventDispatcher.dispatchImmediateSyncUiEvent("test-action-settestproperty");
    expect(visibilityTestFuncCalled).to.eq(true);
    wrapper.update();
    wrapper.should.matchSnapshot();
    wrapper.unmount();
  });

  it("hasRegisteredProviders should correct value", () => {
    expect(BackstageItemManager.hasRegisteredProviders).to.be.true;
  });

});
