/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import * as faker from "faker";
import * as moq from "typemoq";
import { RpcManager } from "@bentley/imodeljs-common";
import { IModelHost } from "@bentley/imodeljs-backend";
import { PresentationError } from "@bentley/presentation-common";
import Presentation from "../Presentation";
import PresentationManager from "../PresentationManager";
import "./IModelHostSetup";
import TemporaryStorage from "../TemporaryStorage";

describe("Presentation", () => {

  afterEach(() => {
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
