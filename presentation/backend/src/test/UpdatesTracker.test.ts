/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as lolex from "lolex";
import * as sinon from "sinon";
import { using } from "@bentley/bentleyjs-core";
import { IModelDb, IpcHost } from "@bentley/imodeljs-backend";
import { PresentationIpcEvents, UpdateInfoJSON } from "@bentley/presentation-common";
import * as moq from "@bentley/presentation-common/lib/test/_helpers/Mocks";
import { NativePlatformDefinition } from "../presentation-backend/NativePlatform";
import { UpdatesTracker } from "../presentation-backend/UpdatesTracker";

describe("UpdatesTracker", () => {
  const nativePlatformMock = moq.Mock.ofType<NativePlatformDefinition>();
  const imodelDbMock = moq.Mock.ofType<IModelDb>();
  let clock: lolex.Clock;
  beforeEach(() => {
    nativePlatformMock.reset();
    imodelDbMock.reset();
    clock = lolex.install();
  });
  afterEach(() => {
    clock.uninstall();
  });

  describe("constructor", () => {

    it("sets up timer callback with specified `pollInterval`", () => {
      const s = sinon.spy(clock, "setInterval");
      using(UpdatesTracker.create({ nativePlatformGetter: () => nativePlatformMock.object, pollInterval: 123 }), (_r) => {
        expect(s).to.be.calledOnce;
        expect(s.firstCall.args[1]).to.eq(123);
      });
    });

  });

  describe("dispose", () => {

    it("stops tracking on dispose", () => {
      const s = sinon.spy(clock, "clearInterval");
      const tracker = UpdatesTracker.create({
        nativePlatformGetter: () => nativePlatformMock.object,
        pollInterval: 123,
      });
      tracker.dispose();
      expect(s).to.be.calledOnce;
    });

  });

  describe("tracking", () => {

    let spy: sinon.SinonSpy<[string, ...any[]], void>;
    let tracker: UpdatesTracker;
    beforeEach(() => {
      spy = sinon.stub(IpcHost, "send");
      tracker = UpdatesTracker.create({
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
      expect(spy).to.not.be.called;
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
      expect(spy).to.be.calledOnceWithExactly(PresentationIpcEvents.Update, expectedUpdateInfo);
    });

    it("does not emit events if imodelDb is not found", () => {
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
      expect(spy).to.not.be.called;
    });

  });

});
