/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect, spy } from "chai";
import { BeEvent } from "@bentley/bentleyjs-core";
import { RpcManager } from "@bentley/imodeljs-common";
import { IModelHost } from "@bentley/imodeljs-backend";
import { PresentationError } from "@bentley/presentation-common";
import Presentation from "@src/Presentation";
import SingleClientPresentationManager from "@src/SingleClientPresentationManager";
import MultiClientPresentationManager from "@src/MultiClientPresentationManager";
import "./IModeHostSetup";

describe("Presentation", () => {

  afterEach(() => {
    Presentation.terminate();
  });

  describe("initialize", () => {

    it("registers rpc implementation", () => {
      const registerSpy = spy.on(RpcManager, RpcManager.registerImpl.name);
      Presentation.initialize();
      expect(registerSpy).to.be.called();
    });

    it("registers itself as IModelHost shutdown listener", () => {
      const addListenerSpy = spy.on(IModelHost.onBeforeShutdown, BeEvent.prototype.addListener.name);
      Presentation.initialize();
      expect(addListenerSpy).to.be.called();
    });

    it("creates a manager instance", () => {
      expect(() => Presentation.manager).to.throw(PresentationError);
      Presentation.initialize();
      expect(Presentation.manager).to.be.instanceof(MultiClientPresentationManager);
    });

  });

  describe("terminate", () => {

    it("resets manager instance", () => {
      Presentation.initialize();
      expect(Presentation.manager).to.be.not.null;
      Presentation.terminate();
      expect(() => Presentation.manager).to.throw(PresentationError);
    });

  });

  describe("setManager", () => {

    it("disposes and overwrites manager instance", () => {
      Presentation.initialize();
      const otherManager = new SingleClientPresentationManager();
      const disposeSpy = spy.on(Presentation.manager, SingleClientPresentationManager.prototype.dispose.name);
      expect(Presentation.manager).to.be.not.null;
      expect(Presentation.manager).to.not.eq(otherManager);
      Presentation.setManager(otherManager);
      expect(Presentation.manager).to.eq(otherManager);
      expect(disposeSpy).to.be.called();
    });

  });

});
