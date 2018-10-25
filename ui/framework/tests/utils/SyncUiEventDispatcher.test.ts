/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { SyncUiEventDispatcher, SyncUiEventArgs } from "../../src/index";
import { expect } from "chai";
import * as sinon from "sinon";

// if you use describe.only the test will run with no errors. If you don't they will not work.
// For now setting all timer test to skip.

describe("SyncUiEventDispatcher", () => {
  let clock = sinon.useFakeTimers(Date.now());

  beforeEach(() => {
    clock = sinon.useFakeTimers(Date.now());
  });

  afterEach(() => {
    clock.restore();
  });

  it("test immediate sync event", () => {
    let callbackCalled = false;
    let callbackHasExpectedEventId = false;

    const handleSyncUiEvent = (args: SyncUiEventArgs): void => {
      // tslint:disable-next-line:no-console
      callbackCalled = true;
      callbackHasExpectedEventId = args.eventIds.has("event1");
    };

    SyncUiEventDispatcher.onSyncUiEvent.addListener(handleSyncUiEvent);

    SyncUiEventDispatcher.dispatchImmediateSyncUiEvent("Event1");
    expect(callbackCalled).to.be.true;
    expect(callbackHasExpectedEventId).to.be.true;
  });

  it.skip("test timed sync event", () => {
    let callbackCalled = false;
    let callbackHasExpectedEventId = false;

    const handleSyncUiEvent = (args: SyncUiEventArgs): void => {
      // tslint:disable-next-line:no-console
      callbackCalled = true;
      callbackHasExpectedEventId = args.eventIds.has("event1");
    };

    SyncUiEventDispatcher.setTimeoutPeriod(10);
    SyncUiEventDispatcher.onSyncUiEvent.addListener(handleSyncUiEvent);

    SyncUiEventDispatcher.dispatchSyncUiEvent("Event1");
    expect(callbackCalled).to.be.false;
    // need to force timer callbacks to fire.
    clock.tick(500);
    expect(callbackCalled).to.be.true;
    expect(callbackHasExpectedEventId).to.be.true;
  });

  it.skip("test multiple event Id with a timed sync event", () => {
    let callbackCalled = false;
    let callbackHasExpectedEventIds = false;

    const handleSyncUiEvent = (args: SyncUiEventArgs): void => {
      // tslint:disable-next-line:no-console
      callbackCalled = true;
      callbackHasExpectedEventIds = args.eventIds.has("event1") && args.eventIds.has("event2");
    };

    SyncUiEventDispatcher.setTimeoutPeriod(10);
    SyncUiEventDispatcher.onSyncUiEvent.addListener(handleSyncUiEvent);

    SyncUiEventDispatcher.dispatchSyncUiEvents(["Event1", "Event2"]);
    expect(callbackCalled).to.be.false;
    // need to force two timer callbacks to fire.
    clock.tick(510);
    expect(callbackCalled).to.be.true;
    expect(callbackHasExpectedEventIds).to.be.true;
  });

  it.skip("test multiple event Id with a multiple dispatches", () => {
    let callbackCalled = false;
    let callbackHasExpectedEventIds = false;

    const handleSyncUiEvent = (args: SyncUiEventArgs): void => {
      // tslint:disable-next-line:no-console
      callbackCalled = true;
      callbackHasExpectedEventIds = args.eventIds.has("event1") && args.eventIds.has("event2") && args.eventIds.has("event3");
    };

    SyncUiEventDispatcher.setTimeoutPeriod(10);
    SyncUiEventDispatcher.onSyncUiEvent.addListener(handleSyncUiEvent);

    SyncUiEventDispatcher.dispatchSyncUiEvents(["Event1", "Event2"]);
    expect(callbackCalled).to.be.false;
    SyncUiEventDispatcher.dispatchSyncUiEvent("Event3");

    clock.tick(10); // timer expiration will see new event id(s) so it should delay onSyncUiEvent processing until next cycle
    expect(callbackCalled).to.be.false;
    clock.tick(1020);

    expect(callbackCalled).to.be.true;
    expect(callbackHasExpectedEventIds).to.be.true;
  });

});
