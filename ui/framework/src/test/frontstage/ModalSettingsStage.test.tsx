/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { render } from "@testing-library/react";
import { CoreTools, FrontstageDef, FrontstageManager, FrontstageProps, ModalFrontstage, ModalFrontstageInfo, SettingsModalFrontstage } from "../../appui-react";
import TestUtils from "../TestUtils";
import { UiFramework } from "../../appui-react/UiFramework";
import { SettingsManager, SettingsTabEntry, SettingsTabsProvider, useSaveBeforeActivatingNewSettingsTab, useSaveBeforeClosingSettingsContainer } from "@itwin/core-react";
import { IModelApp, MockRender } from "@itwin/core-frontend";
import { ConditionalBooleanValue } from "@itwin/appui-abstract";

function TestModalSettingsPage({ settingsManager, title }: { settingsManager: SettingsManager, title: string }) {

  const saveChanges = (afterSaveFunction: (args: any) => void, args?: any) => {
    // for testing just immediately call afterSaveFunction
    afterSaveFunction(args);
  };

  useSaveBeforeClosingSettingsContainer(settingsManager, saveChanges);
  useSaveBeforeActivatingNewSettingsTab(settingsManager, saveChanges);
  return <div>{title}</div>;
}

function renderModalFrontstage(isOpen: boolean): React.ReactElement<any> {
  const activeModalFrontstage: ModalFrontstageInfo | undefined = FrontstageManager.activeModalFrontstage;
  if (!activeModalFrontstage) {
    throw (Error);
  }

  const { title, content, appBarRight } = activeModalFrontstage;

  return (
    <ModalFrontstage
      isOpen={isOpen}
      title={title}
      navigateBack={() => { }}
      closeModal={() => { }}
      appBarRight={appBarRight}
    >
      {content}
    </ModalFrontstage>
  );
}

describe("ModalSettingsStage", () => {
  beforeEach(async () => {
    await TestUtils.initializeUiFramework();
    await MockRender.App.startup();
  });

  afterEach(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiFramework();
  });

  it("will display no settings when none are registered", () => {
    const modalFrontstage = new SettingsModalFrontstage();
    FrontstageManager.openModalFrontstage(modalFrontstage);

    const wrapper = render(renderModalFrontstage(true));
    // wrapper.debug();
    expect(wrapper.container.querySelectorAll("div.uifw-modal-frontstage").length).to.eq(1);

    const centeredDiv = wrapper.container.querySelectorAll("div.uicore-centered");
    expect(centeredDiv.length).to.eq(1);
    expect(centeredDiv[0].textContent).to.eq("settings.noSettingsAvailable");

    FrontstageManager.closeModalFrontstage();
    wrapper.unmount();
  });

  it("will open no available settings message", () => {
    const spyOutput = sinon.spy(IModelApp.notifications, "outputMessage");
    SettingsModalFrontstage.showSettingsStage("page1");
    spyOutput.calledOnce.should.true;
  });

  it("will return action item", () => {
    const backstageActionItem = SettingsModalFrontstage.getBackstageActionItem(400, 40);
    expect(backstageActionItem.groupPriority).to.be.eql(400);
    expect(backstageActionItem.itemPriority).to.be.eql(40);
    expect(backstageActionItem.icon).not.to.be.undefined;
    expect(backstageActionItem.label).not.to.be.undefined;
    expect(ConditionalBooleanValue.getValue(backstageActionItem.isHidden)).to.be.true;
  });

  class TestSettingsProvider implements SettingsTabsProvider {
    public readonly id = "AppSettingsProvider";

    public getSettingEntries(_stageId: string, _stageUsage: string): ReadonlyArray<SettingsTabEntry> | undefined {
      return [
        {
          tabId: "page1", itemPriority: 10, pageWillHandleCloseRequest: true, label: "Page 1", tooltip: "Page1", icon: "icon-measure",
          page: <TestModalSettingsPage settingsManager={UiFramework.settingsManager} title="Page 1" />,
        },
        {
          tabId: "page-2", itemPriority: 20, label: "Page2", subLabel: "sublabel page2", tooltip: <span>react-tooltip</span>, icon: "icon-paintbrush",
          page: <div>Page 2</div>,
        },
        { tabId: "page-3", itemPriority: 30, label: "page3", page: <div>Page 3</div> },
        { tabId: "page-4", itemPriority: 40, label: "page4", subLabel: "disabled page4", isDisabled: true, page: <div>Page 4</div> },
      ];
    }
  }

  it("will display settings because they are registered", async () => {
    const settingsManager = UiFramework.settingsManager;

    const dummy: FrontstageProps = { id: "old", usage: "General", defaultTool: CoreTools.selectElementCommand, contentGroup: TestUtils.TestContentGroup2 };
    const frontstageDef = new FrontstageDef();
    await frontstageDef.initializeFromProps(dummy);
    sinon.stub(FrontstageManager, "activeFrontstageDef").get(() => frontstageDef);

    settingsManager.addSettingsProvider(new TestSettingsProvider());
    // const modalFrontstage = new SettingsModalFrontstage();
    // FrontstageManager.openModalFrontstage(modalFrontstage);
    SettingsModalFrontstage.showSettingsStage(); // set the stage using static

    const wrapper = render(renderModalFrontstage(true));
    await TestUtils.flushAsyncOperations();

    expect(wrapper.container.querySelectorAll("div.uifw-modal-frontstage").length).to.eq(1);
    const liPage1 = wrapper.container.querySelector(`li[data-for='page1']`) as HTMLLIElement;
    expect(liPage1.classList.contains("core-active")).to.be.true;

    SettingsModalFrontstage.showSettingsStage("page2");
    await TestUtils.flushAsyncOperations();
    const liPage2 = wrapper.container.querySelector(`li[data-for='page-2']`) as HTMLLIElement;
    expect(liPage2.classList.contains("core-active")).to.be.true;
    // wrapper.debug();

    SettingsModalFrontstage.showSettingsStage("page-3");
    const liPage3 = wrapper.container.querySelector(`li[data-for='page-3']`) as HTMLLIElement;
    expect(liPage3.classList.contains("core-active")).to.be.true;

    await TestUtils.flushAsyncOperations();

    settingsManager.removeSettingsProvider("AppSettingsProvider");
    FrontstageManager.closeModalFrontstage();
    wrapper.unmount();
  });

  it("set initial stage via tab-id", async () => {
    const settingsManager = UiFramework.settingsManager;

    const dummy: FrontstageProps = { id: "old", usage: "General", defaultTool: CoreTools.selectElementCommand, contentGroup: TestUtils.TestContentGroup2 };
    const frontstageDef = new FrontstageDef();
    await frontstageDef.initializeFromProps(dummy);
    sinon.stub(FrontstageManager, "activeFrontstageDef").get(() => frontstageDef);

    settingsManager.addSettingsProvider(new TestSettingsProvider());
    SettingsModalFrontstage.showSettingsStage("page-3");

    const wrapper = render(renderModalFrontstage(true));
    await TestUtils.flushAsyncOperations();

    SettingsModalFrontstage.showSettingsStage("page-3");
    const liPage3 = wrapper.container.querySelector(`li[data-for='page-3']`) as HTMLLIElement;
    expect(liPage3.classList.contains("core-active")).to.be.true;

    settingsManager.removeSettingsProvider("AppSettingsProvider");
    FrontstageManager.closeModalFrontstage();
    wrapper.unmount();
  });

  it("set initial stage via tab name", async () => {
    const settingsManager = UiFramework.settingsManager;

    const dummy: FrontstageProps = { id: "old", usage: "General", defaultTool: CoreTools.selectElementCommand, contentGroup: TestUtils.TestContentGroup2 };
    const frontstageDef = new FrontstageDef();
    await frontstageDef.initializeFromProps(dummy);
    sinon.stub(FrontstageManager, "activeFrontstageDef").get(() => frontstageDef);

    settingsManager.addSettingsProvider(new TestSettingsProvider());
    SettingsModalFrontstage.showSettingsStage("page2");

    const wrapper = render(renderModalFrontstage(true));
    await TestUtils.flushAsyncOperations();

    await TestUtils.flushAsyncOperations();
    const liPage2 = wrapper.container.querySelector(`li[data-for='page-2']`) as HTMLLIElement;
    expect(liPage2.classList.contains("core-active")).to.be.true;

    settingsManager.removeSettingsProvider("AppSettingsProvider");
    FrontstageManager.closeModalFrontstage();
    wrapper.unmount();
  });

});
