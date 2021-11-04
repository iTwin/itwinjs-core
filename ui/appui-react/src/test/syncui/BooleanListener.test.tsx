/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { BooleanSyncUiListener, SyncUiEventDispatcher } from "../../appui-react";
import TestUtils, { mount } from "../TestUtils";

const syncUiEventId = "showhellocomponentchanged";  // must be lower case

describe("BooleanSyncUiListener", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("BooleanSyncUiListener should mount - visible children", () => {
    const helloWorld = "Hello World!";
    const goodBye = "Goodbye!";
    let showHelloComponent = true;

    const wrapper = mount(
      <BooleanSyncUiListener eventIds={[syncUiEventId]} boolFunc={(): boolean => showHelloComponent}>
        {(showHello: boolean) => showHello ? <div>{helloWorld}</div> : <div>{goodBye}</div>}
      </BooleanSyncUiListener>,
    );

    expect(wrapper.find("div").length).to.eq(1);
    expect(wrapper.find("div").text()).to.eq(helloWorld);

    showHelloComponent = false;
    SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(syncUiEventId);

    wrapper.update();

    expect(wrapper.find("div").length).to.eq(1);
    expect(wrapper.find("div").text()).to.eq(goodBye);
  });

  it("BooleanSyncUiListener should mount - default non-visible children", () => {
    const helloWorld = "Hello World!";
    const goodBye = "Goodbye!";
    const showHelloComponent = true;

    const wrapper = mount(
      <BooleanSyncUiListener eventIds={[syncUiEventId]} boolFunc={(): boolean => showHelloComponent} defaultValue={false}>
        {(showHello: boolean) => showHello ? <div>{helloWorld}</div> : <div>{goodBye}</div>}
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
  });

});
