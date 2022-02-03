/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import type { UiSyncEventArgs } from "../../appui-abstract";
import { UiEventDispatcher } from "../../appui-abstract";

const timeToWaitForUiSyncCallback = 60;

describe("UiEventDispatcher", () => {
  before(async () => {
  });

  after(() => {
  });

  beforeEach(() => {
  });

  it("test hasEventOfInterest", () => {
    const eventDispatcher = new UiEventDispatcher();
    eventDispatcher.setTimeoutPeriod(2);

    const eventIds = new Set<string>();
    eventIds.add("dog");
    eventIds.add("cat");
    eventIds.add("rabbit");

    expect(eventDispatcher.hasEventOfInterest(eventIds, ["dog", "cat", "rabbit"])).to.be.true;
    expect(eventDispatcher.hasEventOfInterest(eventIds, ["dog", "cat"])).to.be.true;
    expect(eventDispatcher.hasEventOfInterest(eventIds, ["dog"])).to.be.true;
    expect(eventDispatcher.hasEventOfInterest(eventIds, ["cat", "rabbit"])).to.be.true;
    expect(eventDispatcher.hasEventOfInterest(eventIds, ["rabbit"])).to.be.true;
    // idsOfInterest are now case insensitive - the set of eventIds held by the dispacther are in lower case.
    expect(eventDispatcher.hasEventOfInterest(eventIds, ["Rabbit"])).to.be.true;
    expect(eventDispatcher.hasEventOfInterest(eventIds, ["DOG", "cAT", "Rabbit"])).to.be.true;
    expect(eventDispatcher.hasEventOfInterest(eventIds, ["horse"])).to.be.false;
  });

  it("test immediate sync event", () => {
    let callbackCalled = false;
    let callbackHasExpectedEventId = false;
    const eventDispatcher = new UiEventDispatcher();
    eventDispatcher.setTimeoutPeriod(2);

    expect(eventDispatcher.timeoutPeriod).to.eq(2);

    const handleSyncUiEvent = (args: UiSyncEventArgs): void => {
      callbackCalled = true;
      callbackHasExpectedEventId = args.eventIds.has("event1");
    };

    eventDispatcher.onSyncUiEvent.addListener(handleSyncUiEvent);

    eventDispatcher.dispatchImmediateSyncUiEvent("Event1");
    expect(callbackCalled).to.be.true;
    expect(callbackHasExpectedEventId).to.be.true;
    eventDispatcher.onSyncUiEvent.removeListener(handleSyncUiEvent);
  });

  it("test timed sync event", () => {
    const fakeTimers = sinon.useFakeTimers();
    let callback1Called = false;
    let callback1HasExpectedEventId = false;
    let callback2Called = false;
    let callback2HasExpectedEventId = false;
    const eventDispatcher = new UiEventDispatcher();
    eventDispatcher.setTimeoutPeriod(2);

    const handleSyncUiEvent1 = (args: UiSyncEventArgs): void => {
      callback1Called = true;
      callback1HasExpectedEventId = args.eventIds.has("event1");
    };

    const handleSyncUiEvent2 = (args: UiSyncEventArgs): void => {
      callback2Called = true;
      callback2HasExpectedEventId = args.eventIds.has("event2");
    };

    eventDispatcher.onSyncUiEvent.addListener(handleSyncUiEvent1);
    eventDispatcher.onSyncUiEvent.addListener(handleSyncUiEvent2);
    eventDispatcher.dispatchSyncUiEvent("Event1");
    expect(callback1Called).to.be.false;
    eventDispatcher.dispatchSyncUiEvent("Event2");
    expect(callback2Called).to.be.false;

    fakeTimers.tick(timeToWaitForUiSyncCallback);
    fakeTimers.restore();

    expect(callback1Called).to.be.true;
    expect(callback1HasExpectedEventId).to.be.true;
    expect(callback2Called).to.be.true;
    expect(callback2HasExpectedEventId).to.be.true;
    eventDispatcher.onSyncUiEvent.removeListener(handleSyncUiEvent1);
    eventDispatcher.onSyncUiEvent.removeListener(handleSyncUiEvent2);
  });

  it("test multiple event Id with a timed sync event", () => {
    const fakeTimers = sinon.useFakeTimers();
    let callbackCalled = false;
    let callbackHasExpectedEventIds = false;
    const eventDispatcher = new UiEventDispatcher();
    eventDispatcher.setTimeoutPeriod(2);

    const handleSyncUiEvent = (args: UiSyncEventArgs): void => {
      callbackCalled = true;
      callbackHasExpectedEventIds = args.eventIds.has("event1") && args.eventIds.has("event2");
    };

    eventDispatcher.onSyncUiEvent.addListener(handleSyncUiEvent);

    eventDispatcher.dispatchSyncUiEvents(["Event1", "Event2"]);
    expect(callbackCalled).to.be.false;

    fakeTimers.tick(timeToWaitForUiSyncCallback);
    fakeTimers.restore();

    expect(callbackCalled).to.be.true;
    expect(callbackHasExpectedEventIds).to.be.true;
    eventDispatcher.onSyncUiEvent.removeListener(handleSyncUiEvent);
  });

  it("test multiple event Id with a multiple dispatches", () => {
    const fakeTimers = sinon.useFakeTimers();
    let callbackCalled = false;
    let callbackHasExpectedEventIds = false;
    const eventDispatcher = new UiEventDispatcher();
    eventDispatcher.setTimeoutPeriod(2);

    const handleSyncUiEvent = (args: UiSyncEventArgs): void => {
      callbackCalled = true;
      callbackHasExpectedEventIds = args.eventIds.has("event1") && args.eventIds.has("event2") && args.eventIds.has("event3");
    };

    eventDispatcher.onSyncUiEvent.addListener(handleSyncUiEvent);

    eventDispatcher.dispatchSyncUiEvents(["Event1", "Event2"]);
    expect(callbackCalled).to.be.false;
    eventDispatcher.dispatchSyncUiEvent("Event3");
    expect(callbackCalled).to.be.false;

    fakeTimers.tick(timeToWaitForUiSyncCallback);
    fakeTimers.restore();

    expect(callbackCalled).to.be.true;
    expect(callbackHasExpectedEventIds).to.be.true;
    eventDispatcher.onSyncUiEvent.removeListener(handleSyncUiEvent);
  });

});
