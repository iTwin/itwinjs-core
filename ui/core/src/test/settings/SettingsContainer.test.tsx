/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { fireEvent, render, wait } from "@testing-library/react";
import { expect } from "chai";
import * as sinon from "sinon";
import { SettingsContainer, useSaveBeforeActivatingNewSettingsTab, useSaveBeforeClosingSettingsContainer } from "../../ui-core/settings/SettingsContainer";
import { SettingsManager, SettingsTabEntry } from "../../ui-core/settings/SettingsManager";
import TestUtils from "../TestUtils";

// cSpell:ignore sublabel

const waitForSpy = async (spy: sinon.SinonSpy, options: { timeout: number } = { timeout: 250 }) => {
  return wait(() => {
    if (!spy.called)
      throw new Error("Waiting for spy timed out!");
  }, { timeout: options.timeout, interval: 10 });
};

function TestModalSettingsPage({ settingsManager, title }: { settingsManager: SettingsManager, title: string }) {

  const saveChanges = (afterSaveFunction: (args: any) => void, args?: any) => {
    // for testing just immediately call afterSaveFunction
    afterSaveFunction(args);
  };

  useSaveBeforeClosingSettingsContainer(settingsManager, saveChanges);
  useSaveBeforeActivatingNewSettingsTab(settingsManager, saveChanges);
  return <div>{title}</div>;
}

describe("<SettingsContainer />", () => {
  const settingsManager = new SettingsManager();

  const tabs: SettingsTabEntry[] = [
    {
      tabId: "page1", itemPriority: 10, pageWillHandleCloseRequest: true, label: "Page 1", tooltip: "Page1", icon: "icon-measure",
      page: <TestModalSettingsPage settingsManager={settingsManager} title="Page 1" />,
    },
    {
      tabId: "page2", itemPriority: 20, label: "Page2", subLabel: "sublabel page2", tooltip: <span>react-tooltip</span>, icon: "icon-paintbrush",
      page: <div>Page 2</div>,
    },
    { tabId: "page3", itemPriority: 30, label: "page3", subLabel: "sublabel page2", page: <div>Page 3</div> },
    { tabId: "tab-page4", itemPriority: 40, label: "page4", subLabel: "disabled page4", isDisabled: true, page: <div>Page 4</div> },
  ];

  it("should render with category header", async () => {
    // note we are setting current tab to "page 2" to avoid the async tab activation process that would
    // ensue if the current tab was page 1 that set pageWillHandleCloseRequest to true.
    const wrapper = render(<SettingsContainer showHeader={true} tabs={tabs} settingsManager={settingsManager} currentSettingsTab={tabs[1]} />);
    const liPage2 = wrapper.container.querySelector(`li[data-for='page2']`) as HTMLLIElement;
    expect(liPage2.classList.contains("core-active")).to.be.true;

    const headerDiv = wrapper.container.querySelector(`div.core-settings-container-right-header`);
    expect(headerDiv).to.not.be.null;
  });

  it("should render", async () => {
    const spyMethod = sinon.spy();

    // note we are setting current tab to "page 2" to avoid the async tab activation process that would
    // ensue if the current tab was page 1 that set pageWillHandleCloseRequest to true.
    const wrapper = render(<SettingsContainer tabs={tabs} settingsManager={settingsManager} currentSettingsTab={tabs[1]}
      onSettingsTabSelected={spyMethod} />);
    // no header should be located since showHeader not specified
    const headerDiv = wrapper.container.querySelector(`div.core-settings-container-right-header`);
    expect(headerDiv).to.be.null;

    let activePageSelector = `li[data-for='page2']`;
    const liPage2 = wrapper.container.querySelector(activePageSelector) as HTMLLIElement;
    expect(liPage2.classList.contains("core-active")).to.be.true;

    const tab3 = wrapper.getByTestId("page3");
    fireEvent.click(tab3);
    await TestUtils.flushAsyncOperations();
    activePageSelector = `li[data-for='page3']`;
    const liPage3 = wrapper.container.querySelector(activePageSelector) as HTMLLIElement;
    expect(liPage3.classList.contains("core-active")).to.be.true;
    expect(spyMethod.calledOnce).to.be.true;
  });

  it("should trigger tab activation", async () => {
    const spyMethod = sinon.spy();

    // note we are setting current tab to "page 2" to avoid the async tab activation process that would
    // ensue if the current tab was page 1 that set pageWillHandleCloseRequest to true.
    const wrapper = render(<SettingsContainer tabs={tabs} settingsManager={settingsManager}
      onSettingsTabSelected={spyMethod} />);
    let activePageSelector = `li[data-for='page1']`;
    const liPage1 = wrapper.container.querySelector(activePageSelector) as HTMLLIElement;
    expect(liPage1.classList.contains("core-active")).to.be.true;

    const tab3 = wrapper.getByTestId("page3");
    fireEvent.click(tab3);
    await waitForSpy(spyMethod, { timeout: 200 });

    activePageSelector = `li[data-for='page3']`;
    const liPage3 = wrapper.container.querySelector(activePageSelector) as HTMLLIElement;
    expect(liPage3.classList.contains("core-active")).to.be.true;
    expect(spyMethod.calledOnce).to.be.true;
  });

  it("simulate tab activation via keyin", async () => {
    const spyMethod = sinon.spy();

    const wrapper = render(<SettingsContainer tabs={tabs} settingsManager={settingsManager}
      onSettingsTabSelected={spyMethod} currentSettingsTab={tabs[1]} />);

    settingsManager.activateSettingsTab("page3");
    await waitForSpy(spyMethod, { timeout: 500 });

    const activePageSelector = `li[data-for='page3']`;
    const liPage3 = wrapper.container.querySelector(activePageSelector) as HTMLLIElement;
    expect(liPage3.classList.contains("core-active")).to.be.true;
    expect(spyMethod.calledOnce).to.be.true;

    spyMethod.resetHistory();
    settingsManager.closeSettingsContainer(spyMethod);
    await waitForSpy(spyMethod, { timeout: 200 });
  });

  it("simulate tab 4 activation via keyin", async () => {
    const spyMethod = sinon.spy();

    const wrapper = render(<SettingsContainer tabs={tabs} settingsManager={settingsManager}
      onSettingsTabSelected={spyMethod} />);

    settingsManager.activateSettingsTab("page4");
    await TestUtils.flushAsyncOperations();
    // should not activate page 4 since it is disabled
    const activePageSelector = `li[data-for='page1']`;
    const liPage1 = wrapper.container.querySelector(activePageSelector) as HTMLLIElement;
    expect(liPage1.classList.contains("core-active")).to.be.true;
  });

  it("should trigger close activation", async () => {
    const spyMethod = sinon.spy();

    // note we are setting current tab to "page 2" to avoid the async tab activation process that would
    // ensue if the current tab was page 1 that set pageWillHandleCloseRequest to true.
    const wrapper = render(<SettingsContainer tabs={tabs} settingsManager={settingsManager} />);
    const activePageSelector = `li[data-for='page1']`;
    const liPage1 = wrapper.container.querySelector(activePageSelector) as HTMLLIElement;
    expect(liPage1.classList.contains("core-active")).to.be.true;

    // trigger the close container processing
    settingsManager.closeSettingsContainer(spyMethod);
    await waitForSpy(spyMethod, { timeout: 200 });

    wrapper.unmount();
  });

});

