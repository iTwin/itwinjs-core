/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { BriefcaseDb, IModelHost, IpcHost } from "@itwin/core-backend";
import { assert, BeEvent } from "@itwin/core-bentley";
import { RpcManager } from "@itwin/core-common";
import { PresentationError } from "@itwin/presentation-common";
import { NativePlatformDefinition } from "../presentation-backend/NativePlatform.js";
import { Presentation } from "../presentation-backend/Presentation.js";
import { PresentationIpcHandler } from "../presentation-backend/PresentationIpcHandler.js";
import { PresentationManager } from "../presentation-backend/PresentationManager.js";
import { PresentationRpcImpl } from "../presentation-backend/PresentationRpcImpl.js";
import { TemporaryStorage } from "../presentation-backend/TemporaryStorage.js";
import { _presentation_manager_detail } from "../presentation-backend/InternalSymbols.js";
import { PresentationManagerDetail } from "../presentation-backend/PresentationManagerDetail.js";

describe("Presentation", () => {
  afterEach(async () => {
    Presentation.terminate();
  });

  describe("initialize", () => {
    it("registers rpc implementation", () => {
      const registerSpy = sinon.spy(RpcManager, "registerImpl");
      Presentation.initialize();
      expect(registerSpy).to.be.calledOnce;
    });

    it("registers itself as IModelHost shutdown listener", () => {
      const addListenerSpy = sinon.spy(IModelHost.onBeforeShutdown, "addListener");
      Presentation.initialize();
      expect(addListenerSpy).to.be.calledOnce;
    });

    it("can be safely shutdown via IModelHost shutdown listener", async () => {
      const onBeforeShutdown: (typeof IModelHost)["onBeforeShutdown"] = new BeEvent();
      sinon.stub(IModelHost, "onBeforeShutdown").get(() => onBeforeShutdown);

      Presentation.initialize({
        // @ts-expect-error internal prop
        clientManagerFactory: () =>
          ({
            onUsed: new BeEvent(),
            [Symbol.dispose]: sinon.stub(),
          }) as unknown as PresentationManager,
      });
      expect(onBeforeShutdown.numberOfListeners).to.eq(1);
      expect(Presentation.getManager()).to.not.be.undefined;

      onBeforeShutdown.raiseEvent();
      expect(() => Presentation.getManager()).to.throw(PresentationError);
    });

    it("creates a manager instance", () => {
      expect(() => Presentation.getManager()).to.throw(PresentationError);
      Presentation.initialize();
      expect(Presentation.getManager()).to.be.instanceof(PresentationManager);
    });

    it("subscribes for `BriefcaseDb.onOpened` event if `enableSchemasPreload` is set", () => {
      Presentation.initialize({ enableSchemasPreload: false });
      expect(BriefcaseDb.onOpened.numberOfListeners).to.eq(0);
      Presentation.terminate();
      Presentation.initialize({ enableSchemasPreload: true });
      expect(BriefcaseDb.onOpened.numberOfListeners).to.eq(1);
    });

    describe("props handling", () => {
      it("sets unused client lifetime provided through props", () => {
        Presentation.initialize({ unusedClientLifetime: 4455 });
        const storage = (Presentation as any)._clientsStorage as TemporaryStorage<PresentationManager>;
        expect(storage.props.unusedValueLifetime).to.eq(Presentation.initProps!.unusedClientLifetime);
      });

      it("sets request timeout to `PresentationRpcImpl`", () => {
        const supplyImplSpy = sinon.spy(RpcManager, "supplyImplInstance");
        Presentation.initialize({ requestTimeout: 123 });
        const impl = supplyImplSpy.args[0][1];
        assert(impl instanceof PresentationRpcImpl);
        expect(impl.requestTimeout).to.eq(123);
        expect(Presentation.getRequestTimeout()).to.eq(123);
      });

      it("uses client manager factory provided through props", () => {
        const managerMock = moq.Mock.ofType<PresentationManager>();
        managerMock.setup((x) => x.onUsed).returns(() => new BeEvent());
        Presentation.initialize({
          // @ts-expect-error internal prop
          clientManagerFactory: () => managerMock.object,
        });
        expect(Presentation.getManager()).to.eq(managerMock.object);
      });
    });
  });

  describe("getRequestTimeout", () => {
    it("should throw PresentationError if initialize is not called", () => {
      expect(() => Presentation.getRequestTimeout()).to.throw(PresentationError);
    });
  });

  describe("terminate", () => {
    it("resets manager instance", () => {
      Presentation.initialize();
      expect(Presentation.getManager()).to.be.not.null;
      Presentation.terminate();
      expect(() => Presentation.getManager()).to.throw(PresentationError);
    });

    it("unregisters PresentationRpcInterface impl", () => {
      Presentation.initialize();
      const unregisterSpy = sinon.stub(RpcManager, "unregisterImpl");
      Presentation.terminate();
      expect(unregisterSpy).to.be.calledOnce;
    });

    it("unregisters PresentationIpcHandler if IpcHost is valid", () => {
      sinon.stub(IpcHost, "isValid").get(() => true);
      const unregisterSpy = sinon.spy();
      sinon.stub(PresentationIpcHandler, "register").returns(unregisterSpy);
      Presentation.initialize();
      expect(unregisterSpy).to.not.be.called;
      Presentation.terminate();
      expect(unregisterSpy).to.be.calledOnce;
    });

    it("unsubscribes from `BriefcaseDb.onOpened` event if `enableSchemasPreload` is set", () => {
      Presentation.initialize({ enableSchemasPreload: true });
      expect(BriefcaseDb.onOpened.numberOfListeners).to.eq(1);
      Presentation.terminate();
      expect(BriefcaseDb.onOpened.numberOfListeners).to.eq(0);
    });
  });

  describe("preloading schemas", () => {
    it("calls addon's `forceLoadSchemas` on `BriefcaseDb.onOpened` events", () => {
      const imodelMock = moq.Mock.ofType<BriefcaseDb>();
      const nativePlatformMock = moq.Mock.ofType<NativePlatformDefinition>();
      const managerMock = moq.Mock.ofType<PresentationManager>();
      managerMock.setup((x) => x.onUsed).returns(() => new BeEvent());
      managerMock
        .setup((x) => x[_presentation_manager_detail])
        .returns(
          () =>
            ({
              getNativePlatform: () => nativePlatformMock.object,
            }) as PresentationManagerDetail,
        );
      nativePlatformMock.setup((x) => x.getImodelAddon(imodelMock.object)).verifiable(moq.Times.atLeastOnce());

      Presentation.initialize({
        enableSchemasPreload: true,
        // @ts-expect-error internal prop
        clientManagerFactory: () => managerMock.object,
      });
      BriefcaseDb.onOpened.raiseEvent(imodelMock.object, {} as any);
      nativePlatformMock.verify(async (x) => x.forceLoadSchemas(moq.It.isAny()), moq.Times.once());
    });
  });
});
