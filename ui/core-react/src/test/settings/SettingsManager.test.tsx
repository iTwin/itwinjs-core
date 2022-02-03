/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { render } from "@testing-library/react";
import { expect } from "chai";
import * as sinon from "sinon";
import { SettingsContainer, useSaveBeforeActivatingNewSettingsTab, useSaveBeforeClosingSettingsContainer } from "../../core-react/settings/SettingsContainer";
import type { SettingsTabEntry, SettingsTabsProvider } from "../../core-react/settings/SettingsManager";
import { SettingsManager } from "../../core-react/settings/SettingsManager";

function TestModalSettingsPage({ settingsManager, title }: { settingsManager: SettingsManager, title: string }) {

  const saveChanges = (afterSaveFunction: (args: any) => void, args?: any) => {
    // for testing just immediately call afterSaveFunction
    afterSaveFunction(args);
  };

  useSaveBeforeClosingSettingsContainer(settingsManager, saveChanges);
  useSaveBeforeActivatingNewSettingsTab(settingsManager, saveChanges);
  return <div>{title}</div>;
}

describe("<SettingsManager />", () => {
  const settingsManager = new SettingsManager();

  class TestSettingsProvider implements SettingsTabsProvider {
    public readonly id = "AppSettingsProvider";

    public getSettingEntries(_stageId: string, _stageUsage: string): ReadonlyArray<SettingsTabEntry> | undefined {
      return [
        {
          tabId: "page1", itemPriority: 10, pageWillHandleCloseRequest: true, label: "Page 1", tooltip: "Page1", icon: "icon-measure",
          page: <TestModalSettingsPage settingsManager={settingsManager} title="Page 1" />,
        },
        {
          tabId: "page2", itemPriority: 20, label: "Page2", subLabel: "Sub-label page2", tooltip: <span>react-tooltip</span>, icon: "icon-paintbrush",
          page: <div>Page 2</div>,
        },
        { tabId: "page3", itemPriority: 30, label: "page3", page: <div>Page 3</div> },
        { tabId: "page4", itemPriority: 40, label: "page4", subLabel: "Disabled page4", isDisabled: true, page: <div>Page 4</div> },
      ];
    }
  }

  it("should render", async () => {
    const testProvider = new TestSettingsProvider();

    expect(settingsManager.getSettingEntries("testStage", "General").length).to.be.eql(0);

    settingsManager.addSettingsProvider(testProvider);
    settingsManager.addSettingsProvider(testProvider); // second add is ignored.

    const tabEntries = settingsManager.getSettingEntries("testStage", "General");

    const wrapper = render(<SettingsContainer tabs={tabEntries ?? []} settingsManager={settingsManager} />);
    const activePageSelector = `li[data-for='page1']`;
    const liPage1 = wrapper.container.querySelector(activePageSelector) as HTMLLIElement;
    expect(liPage1.classList.contains("core-active")).to.be.true;
    wrapper.unmount();
    expect(settingsManager.removeSettingsProvider(testProvider.id)).to.be.true;
    expect(settingsManager.removeSettingsProvider(testProvider.id)).to.be.false;
  });

  it("should fire close events", async () => {
    const spyCloseMethod = sinon.spy();

    const handleProcessSettingsContainerClose = () => {
      spyCloseMethod();
    };

    settingsManager.onCloseSettingsContainer.addOnce(handleProcessSettingsContainerClose);
    settingsManager.closeSettingsContainer(() => { });
    expect(spyCloseMethod.calledOnce).to.be.true;
  });

  it("should fire change tab events", async () => {
    const spyChangeTabMethod = sinon.spy();

    const handleProcessChangeTab = () => {
      spyChangeTabMethod();
    };

    settingsManager.onActivateSettingsTab.addOnce(handleProcessChangeTab);
    settingsManager.activateSettingsTab("test-tab-id");
    expect(spyChangeTabMethod.calledOnce).to.be.true;
  });

});

