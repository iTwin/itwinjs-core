/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { SyncUiEventDispatcher, SyncUiEventArgs } from "../../ui-framework";
import { expect } from "chai";
import * as sinon from "sinon";
import {
  FrontstageManager, ContentControlActivatedEventArgs, ContentLayoutActivatedEventArgs,
  FrontstageActivatedEventArgs, FrontstageReadyEventArgs, ModalFrontstageChangedEventArgs,
  NavigationAidActivatedEventArgs, ToolActivatedEventArgs, WidgetStateChangedEventArgs,
} from "../../ui-framework/frontstage/FrontstageManager";
import { Backstage, BackstageCloseEventArgs } from "../../ui-framework/backstage/Backstage";
import { WorkflowManager, TaskActivatedEventArgs, WorkflowActivatedEventArgs } from "../../ui-framework/workflow/Workflow";
import { ContentViewManager, ActiveContentChangedEventArgs } from "../../ui-framework/content/ContentViewManager";

describe("SyncUiEventDispatcher", () => {
  let clock = sinon.useFakeTimers(Date.now());
  clock.restore();

  beforeEach(() => {
    clock = sinon.useFakeTimers(Date.now());
  });

  afterEach(() => {
    clock.restore();
  });

  it("test hasEventOfInterest", () => {
    const eventIds = new Set<string>();
    eventIds.add("dog");
    eventIds.add("cat");
    eventIds.add("rabbit");

    expect(SyncUiEventDispatcher.hasEventOfInterest(eventIds, ["dog", "cat", "rabbit"])).to.be.true;
    expect(SyncUiEventDispatcher.hasEventOfInterest(eventIds, ["dog", "cat"])).to.be.true;
    expect(SyncUiEventDispatcher.hasEventOfInterest(eventIds, ["dog"])).to.be.true;
    expect(SyncUiEventDispatcher.hasEventOfInterest(eventIds, ["cat", "rabbit"])).to.be.true;
    expect(SyncUiEventDispatcher.hasEventOfInterest(eventIds, ["rabbit"])).to.be.true;
    // test is case sensitive
    expect(SyncUiEventDispatcher.hasEventOfInterest(eventIds, ["Rabbit"])).to.be.false;
  });

  it("test immediate sync event", () => {
    let callbackCalled = false;
    let callbackHasExpectedEventId = false;

    const handleSyncUiEvent = (args: SyncUiEventArgs): void => {
      callbackCalled = true;
      callbackHasExpectedEventId = args.eventIds.has("event1");
    };

    SyncUiEventDispatcher.onSyncUiEvent.addListener(handleSyncUiEvent);

    SyncUiEventDispatcher.dispatchImmediateSyncUiEvent("Event1");
    expect(callbackCalled).to.be.true;
    expect(callbackHasExpectedEventId).to.be.true;
    SyncUiEventDispatcher.onSyncUiEvent.removeListener(handleSyncUiEvent);
  });

  it.skip("test timed sync event", () => {
    let callbackCalled = false;
    let callbackHasExpectedEventId = false;

    const handleSyncUiEvent = (args: SyncUiEventArgs): void => {
      callbackCalled = true;
      callbackHasExpectedEventId = args.eventIds.has("event1");
    };

    SyncUiEventDispatcher.setTimeoutPeriod(10);
    SyncUiEventDispatcher.onSyncUiEvent.addListener(handleSyncUiEvent);

    SyncUiEventDispatcher.dispatchSyncUiEvent("Event1");
    expect(callbackCalled).to.be.false;
    // need to force timer callbacks to fire.
    clock.tick(12);
    expect(callbackCalled).to.be.true;
    expect(callbackHasExpectedEventId).to.be.true;
    SyncUiEventDispatcher.onSyncUiEvent.removeListener(handleSyncUiEvent);
  });

  it.skip("test multiple event Id with a timed sync event", () => {
    let callbackCalled = false;
    let callbackHasExpectedEventIds = false;

    const handleSyncUiEvent = (args: SyncUiEventArgs): void => {
      callbackCalled = true;
      callbackHasExpectedEventIds = args.eventIds.has("event1") && args.eventIds.has("event2");
    };

    SyncUiEventDispatcher.setTimeoutPeriod(10);
    SyncUiEventDispatcher.onSyncUiEvent.addListener(handleSyncUiEvent);

    SyncUiEventDispatcher.dispatchSyncUiEvents(["Event1", "Event2"]);
    expect(callbackCalled).to.be.false;
    // need to force two timer callbacks to fire.
    clock.tick(12);
    expect(callbackCalled).to.be.true;
    expect(callbackHasExpectedEventIds).to.be.true;
    SyncUiEventDispatcher.onSyncUiEvent.removeListener(handleSyncUiEvent);
  });

  it.skip("test multiple event Id with a multiple dispatches", () => {
    let callbackCalled = false;
    let callbackHasExpectedEventIds = false;

    const handleSyncUiEvent = (args: SyncUiEventArgs): void => {
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
    clock.tick(20);
    expect(callbackCalled).to.be.true;
    expect(callbackHasExpectedEventIds).to.be.true;
    SyncUiEventDispatcher.onSyncUiEvent.removeListener(handleSyncUiEvent);
  });

  it.skip("Test event handlers", () => {
    const handleSyncUiEvent = sinon.spy();

    SyncUiEventDispatcher.initialize();
    SyncUiEventDispatcher.onSyncUiEvent.addListener(handleSyncUiEvent);

    handleSyncUiEvent.resetHistory();
    FrontstageManager.onContentControlActivatedEvent.emit({} as ContentControlActivatedEventArgs);
    clock.tick(20); // timer expiration will see new event id(s) so it should delay onSyncUiEvent processing until next cycle
    expect(handleSyncUiEvent.calledOnce).to.be.true;

    handleSyncUiEvent.resetHistory();
    FrontstageManager.onContentLayoutActivatedEvent.emit({} as ContentLayoutActivatedEventArgs);
    clock.tick(20); // timer expiration will see new event id(s) so it should delay onSyncUiEvent processing until next cycle
    expect(handleSyncUiEvent.calledOnce).to.be.true;

    handleSyncUiEvent.resetHistory();
    FrontstageManager.onFrontstageActivatedEvent.emit({} as FrontstageActivatedEventArgs);
    clock.tick(20); // timer expiration will see new event id(s) so it should delay onSyncUiEvent processing until next cycle
    expect(handleSyncUiEvent.calledOnce).to.be.true;

    handleSyncUiEvent.resetHistory();
    FrontstageManager.onFrontstageReadyEvent.emit({} as FrontstageReadyEventArgs);
    clock.tick(20); // timer expiration will see new event id(s) so it should delay onSyncUiEvent processing until next cycle
    expect(handleSyncUiEvent.calledOnce).to.be.true;

    handleSyncUiEvent.resetHistory();
    FrontstageManager.onModalFrontstageChangedEvent.emit({} as ModalFrontstageChangedEventArgs);
    clock.tick(20); // timer expiration will see new event id(s) so it should delay onSyncUiEvent processing until next cycle
    expect(handleSyncUiEvent.calledOnce).to.be.true;

    handleSyncUiEvent.resetHistory();
    FrontstageManager.onNavigationAidActivatedEvent.emit({} as NavigationAidActivatedEventArgs);
    clock.tick(20); // timer expiration will see new event id(s) so it should delay onSyncUiEvent processing until next cycle
    expect(handleSyncUiEvent.calledOnce).to.be.true;

    handleSyncUiEvent.resetHistory();
    FrontstageManager.onToolActivatedEvent.emit({} as ToolActivatedEventArgs);
    clock.tick(20); // timer expiration will see new event id(s) so it should delay onSyncUiEvent processing until next cycle
    expect(handleSyncUiEvent.calledOnce).to.be.true;

    handleSyncUiEvent.resetHistory();
    FrontstageManager.onWidgetStateChangedEvent.emit({} as WidgetStateChangedEventArgs);
    clock.tick(20); // timer expiration will see new event id(s) so it should delay onSyncUiEvent processing until next cycle
    expect(handleSyncUiEvent.calledOnce).to.be.true;

    handleSyncUiEvent.resetHistory();
    Backstage.onBackstageCloseEvent.emit({} as BackstageCloseEventArgs);
    clock.tick(20); // timer expiration will see new event id(s) so it should delay onSyncUiEvent processing until next cycle
    expect(handleSyncUiEvent.calledOnce).to.be.true;

    handleSyncUiEvent.resetHistory();
    WorkflowManager.onTaskActivatedEvent.emit({} as TaskActivatedEventArgs);
    clock.tick(20); // timer expiration will see new event id(s) so it should delay onSyncUiEvent processing until next cycle
    expect(handleSyncUiEvent.calledOnce).to.be.true;

    handleSyncUiEvent.resetHistory();
    WorkflowManager.onWorkflowActivatedEvent.emit({} as WorkflowActivatedEventArgs);
    clock.tick(20); // timer expiration will see new event id(s) so it should delay onSyncUiEvent processing until next cycle
    expect(handleSyncUiEvent.calledOnce).to.be.true;

    handleSyncUiEvent.resetHistory();
    ContentViewManager.onActiveContentChangedEvent.emit({} as ActiveContentChangedEventArgs);
    clock.tick(20); // timer expiration will see new event id(s) so it should delay onSyncUiEvent processing until next cycle
    expect(handleSyncUiEvent.calledOnce).to.be.true;

    SyncUiEventDispatcher.onSyncUiEvent.removeListener(handleSyncUiEvent);
  });
});
