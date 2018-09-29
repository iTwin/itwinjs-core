/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect, spy } from "chai";
import * as faker from "faker";
import * as moq from "typemoq";
import { BeEvent } from "@bentley/bentleyjs-core";
import { RpcManager } from "@bentley/imodeljs-common";
import { IModelHost } from "@bentley/imodeljs-backend";
import { PresentationError } from "@bentley/presentation-common";
import Presentation from "../lib/Presentation";
import PresentationManager from "../lib/PresentationManager";
import "./IModelHostSetup";
import TemporaryStorage from "../lib/TemporaryStorage";

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
      expect(() => Presentation.getManager()).to.throw(PresentationError);
      Presentation.initialize();
      expect(Presentation.getManager()).to.be.instanceof(PresentationManager);
    });

    describe("props handling", () => {

      it("sets unused client lifetime provided through props", () => {
        Presentation.initialize({ unusedClientLifetime: faker.random.number() });
        const storage = (Presentation as any)._clientsStorage as TemporaryStorage<PresentationManager>;
        expect(storage.props.valueLifetime).to.eq(Presentation.initProps!.unusedClientLifetime);
      });

      it("uses client manager factory provided through props", () => {
        const managerMock = moq.Mock.ofType<PresentationManager>();
        Presentation.initialize({ clientManagerFactory: () => managerMock.object });
        expect(Presentation.getManager()).to.eq(managerMock.object);
      });

    });

  });

  describe("terminate", () => {

    it("resets manager instance", () => {
      Presentation.initialize();
      expect(Presentation.getManager()).to.be.not.null;
      Presentation.terminate();
      expect(() => Presentation.getManager()).to.throw(PresentationError);
    });

  });

});
