/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as lolex from "lolex";
import * as sinon from "sinon";
import { using } from "@bentley/bentleyjs-core";
import { EventSink, IModelDb } from "@bentley/imodeljs-backend";
import { PresentationRpcEvents, PresentationRpcInterface, UpdateInfoJSON } from "@bentley/presentation-common";
import * as moq from "@bentley/presentation-common/lib/test/_helpers/Mocks";
import { NativePlatformDefinition } from "../presentation-backend/NativePlatform";
import { UpdatesTracker } from "../presentation-backend/UpdatesTracker";

describe("UpdatesTracker", () => {

  const eventSinkMock = moq.Mock.ofType<EventSink>();
  const nativePlatformMock = moq.Mock.ofType<NativePlatformDefinition>();
  const imodelDbMock = moq.Mock.ofType<IModelDb>();
  let clock: lolex.Clock;
  beforeEach(() => {
    nativePlatformMock.reset();
    eventSinkMock.reset();
    imodelDbMock.reset();
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
      tracker.dispose();
    });

    it("doesn't emit events if there are no updates", () => {
      nativePlatformMock.setup((x) => x.getUpdateInfo()).returns(() => ({ result: undefined }));
      clock.tick(1);
      nativePlatformMock.verify((x) => x.getUpdateInfo(), moq.Times.once());
      eventSinkMock.verify((x) => x.emit(moq.It.isAny(), moq.It.isAny(), moq.It.isAny()), moq.Times.never());
    });

    it("emits events if there are updates", () => {
      const updates: UpdateInfoJSON = {
        ["imodel-File-Path"]: {
          "a-ruleset": { hierarchy: [] },
          "b-ruleset": { hierarchy: "FULL" },
          "c-ruleset": { content: "FULL" },
        },
      };
      nativePlatformMock.setup((x) => x.getUpdateInfo()).returns(() => ({ result: updates }));
      const findDbStub = sinon.stub(IModelDb, "findByFilename");
      findDbStub.returns(imodelDbMock.object);
      imodelDbMock.setup((x) => x.getRpcProps()).returns(() => ({ key: "imodelKey" }));

      clock.tick(1);
      nativePlatformMock.verify((x) => x.getUpdateInfo(), moq.Times.once());

      const expectedUpdateInfo: UpdateInfoJSON = {
        ["imodelKey"]: updates["imodel-File-Path"],
      };
      eventSinkMock.verify((x) => x.emit(PresentationRpcInterface.interfaceName, PresentationRpcEvents.Update, expectedUpdateInfo), moq.Times.once());
    });

    it("does not emit events if imodelDb is not fount", () => {
      const updates: UpdateInfoJSON = {
        ["imodel-File-Path"]: {
          "a-ruleset": { hierarchy: "FULL" },
        },
      };
      nativePlatformMock.setup((x) => x.getUpdateInfo()).returns(() => ({ result: updates }));
      const findDbStub = sinon.stub(IModelDb, "findByFilename");
      findDbStub.returns(undefined);
      clock.tick(1);
      nativePlatformMock.verify((x) => x.getUpdateInfo(), moq.Times.once());

      eventSinkMock.verify((x) => x.emit(PresentationRpcInterface.interfaceName, PresentationRpcEvents.Update, moq.It.isAny()), moq.Times.never());
    });

  });

});
