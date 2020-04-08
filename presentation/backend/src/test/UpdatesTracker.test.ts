/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import * as lolex from "lolex";
import * as moq from "@bentley/presentation-common/lib/test/_helpers/Mocks";
import { using } from "@bentley/bentleyjs-core";
import { EventSink } from "@bentley/imodeljs-backend";
import { UpdateInfo, PresentationRpcInterface, PresentationRpcEvents } from "@bentley/presentation-common";
import { UpdatesTracker } from "../presentation-backend/UpdatesTracker";
import { NativePlatformDefinition } from "../presentation-backend/NativePlatform";

describe("UpdatesTracker", () => {

  const eventSinkMock = moq.Mock.ofType<EventSink>();
  const nativePlatformMock = moq.Mock.ofType<NativePlatformDefinition>();
  let clock: lolex.Clock;
  beforeEach(() => {
    nativePlatformMock.reset();
    eventSinkMock.reset();
    clock = lolex.install();
  });
  afterEach(() => {
    clock.uninstall();
  });

  describe("constructor", () => {

    it("sets up timer callback with specified `pollInterval`", () => {
      const s = sinon.spy(clock, "setInterval");
      using(UpdatesTracker.create({ eventSink: eventSinkMock.object, nativePlatformGetter: () => nativePlatformMock.object, pollInterval: 123 }), (_r) => {
        expect(s).to.be.calledOnce;
        expect(s.firstCall.args[1]).to.eq(123);
      });
    });

  });

  describe("dispose", () => {

    it("stops tracking on dispose", () => {
      const s = sinon.spy(clock, "clearInterval");
      const tracker = UpdatesTracker.create({
        eventSink: eventSinkMock.object,
        nativePlatformGetter: () => nativePlatformMock.object,
        pollInterval: 123,
      });
      tracker.dispose();
      expect(s).to.be.calledOnce;
    });

  });

  describe("tracking", () => {

    let tracker: UpdatesTracker;
    beforeEach(() => {
      tracker = UpdatesTracker.create({
        eventSink: eventSinkMock.object,
        nativePlatformGetter: () => nativePlatformMock.object,
        pollInterval: 1,
      });
    });
    afterEach(() => {
      tracker.dispose;
    });

    it("doesn't emit events if there are no updates", () => {
      nativePlatformMock.setup((x) => x.getUpdateInfo()).returns(() => undefined);
      clock.tick(1);
      nativePlatformMock.verify((x) => x.getUpdateInfo(), moq.Times.once());
      eventSinkMock.verify((x) => x.emit(moq.It.isAny(), moq.It.isAny(), moq.It.isAny()), moq.Times.never());
    });

    it("emits events if there are updates", () => {
      const updates: UpdateInfo = {
        "a-ruleset": { hierarchy: [] },
        "b-ruleset": { hierarchy: "FULL" },
        "c-ruleset": { content: "FULL" },
      };
      nativePlatformMock.setup((x) => x.getUpdateInfo()).returns(() => updates);
      clock.tick(1);
      nativePlatformMock.verify((x) => x.getUpdateInfo(), moq.Times.once());
      eventSinkMock.verify((x) => x.emit(PresentationRpcInterface.interfaceName, PresentationRpcEvents.Update, updates), moq.Times.once());
    });

  });

});
