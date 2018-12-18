/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import { mount } from "enzyme";

import TestUtils from "../TestUtils";
import {
  BooleanSyncUiListener, SyncUiEventDispatcher,
} from "../../ui-framework";

describe("BooleanSyncUiListener", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  it("BooleanSyncUiListener should mount - visible children", () => {
    const helloWorld = "Hello World!";
    const goodBye = "Goodbye!";
    const syncUiEventId = "showchildrenchanged";  // must be lower case
    let showChildren = true;

    const wrapper = mount(
      <BooleanSyncUiListener eventIds={[syncUiEventId]} boolFunc={(): boolean => showChildren}>
        {(isVisible: boolean) => isVisible ? <div>{helloWorld}</div> : <div>{goodBye}</div>}
      </BooleanSyncUiListener>,
    );

    expect(wrapper.find("div").length).to.eq(1);
    expect(wrapper.find("div").text()).to.eq(helloWorld);

    showChildren = false;
    SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(syncUiEventId);

    wrapper.update();

    expect(wrapper.find("div").length).to.eq(1);
    expect(wrapper.find("div").text()).to.eq(goodBye);

    wrapper.unmount();
  });

  it("BooleanSyncUiListener should mount - default non-visible children", () => {
    const helloWorld = "Hello World!";
    const goodBye = "Goodbye!";
    const syncUiEventId = "showchildrenchanged";  // must be lower case
    const showChildren = true;

    const wrapper = mount(
      <BooleanSyncUiListener eventIds={[syncUiEventId]} boolFunc={(): boolean => showChildren} defaultValue={false}>
        {(isVisible: boolean) => isVisible ? <div>{helloWorld}</div> : <div>{goodBye}</div>}
      </BooleanSyncUiListener>,
    );

    // it should be showing falsy contents
    expect(wrapper.find("div").length).to.eq(1);
    expect(wrapper.find("div").text()).to.eq(goodBye);

    SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(syncUiEventId);
    wrapper.update();

    // now that sync event forced function to run it should be showing true contents
    expect(wrapper.find("div").length).to.eq(1);
    expect(wrapper.find("div").text()).to.eq(helloWorld);

    wrapper.unmount();
  });

});
