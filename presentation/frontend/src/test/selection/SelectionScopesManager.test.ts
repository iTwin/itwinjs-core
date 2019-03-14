/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/* tslint:disable:no-direct-imports */

import { expect } from "chai";
import * as moq from "typemoq";
import {
  createRandomSelectionScope, createRandomId,
} from "@bentley/presentation-common/lib/test/_helpers/random";
import { IModelToken } from "@bentley/imodeljs-common";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { RpcRequestsHandler, KeySet } from "@bentley/presentation-common";
import { SelectionScopesManager, SelectionScopesManagerProps } from "../../selection/SelectionScopesManager";

describe("SelectionScopesManager", () => {

  const imodelToken = new IModelToken();
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const rpcRequestsHandlerMock = moq.Mock.ofType<RpcRequestsHandler>();
  let manager: SelectionScopesManager | undefined;
  let managerProps: SelectionScopesManagerProps;

  const getManager = () => {
    if (!manager)
      manager = new SelectionScopesManager(managerProps);
    return manager;
  };

  beforeEach(() => {
    imodelMock.reset();
    imodelMock.setup((x) => x.iModelToken).returns(() => imodelToken);
    rpcRequestsHandlerMock.reset();
    manager = undefined;
    managerProps = {
      rpcRequestsHandler: rpcRequestsHandlerMock.object,
    };
  });

  describe("activeScope", () => {

    it("gets and sets active scope as string", () => {
      expect(getManager().activeScope).to.be.undefined;
      getManager().activeScope = "test";
      expect(getManager().activeScope).to.eq("test");
    });

    it("gets and sets active scope as SelectionScope", () => {
      expect(getManager().activeScope).to.be.undefined;
      const scope = createRandomSelectionScope();
      getManager().activeScope = scope;
      expect(getManager().activeScope).to.eq(scope);
    });

  });

  describe("getSelectionScopes", () => {

    it("forwards request to RpcRequestsHandler", async () => {
      const result = [createRandomSelectionScope()];
      rpcRequestsHandlerMock
        .setup(async (x) => x.getSelectionScopes(moq.It.isObjectWith({ imodel: imodelToken, locale: undefined })))
        .returns(async () => result)
        .verifiable();
      expect(await getManager().getSelectionScopes(imodelMock.object)).to.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

    it("passes locale provided by localeProvider when request locale is not set", async () => {
      managerProps = {
        ...managerProps,
        localeProvider: () => "lt",
      };
      const result = [createRandomSelectionScope()];
      rpcRequestsHandlerMock
        .setup(async (x) => x.getSelectionScopes(moq.It.isObjectWith({ imodel: imodelToken, locale: "lt" })))
        .returns(async () => result)
        .verifiable();
      expect(await getManager().getSelectionScopes(imodelMock.object)).to.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

    it("passes request locale when set", async () => {
      managerProps = {
        ...managerProps,
        localeProvider: () => "lt",
      };
      const result = [createRandomSelectionScope()];
      rpcRequestsHandlerMock
        .setup(async (x) => x.getSelectionScopes(moq.It.isObjectWith({ imodel: imodelToken, locale: "de" })))
        .returns(async () => result)
        .verifiable();
      expect(await getManager().getSelectionScopes(imodelMock.object, "de")).to.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("computeSelection", () => {

    it("forwards request to RpcRequestsHandler with scope as SelectionScope", async () => {
      const ids = [createRandomId()];
      const scope = createRandomSelectionScope();
      const result = new KeySet();
      rpcRequestsHandlerMock
        .setup(async (x) => x.computeSelection(moq.It.isObjectWith({ imodel: imodelToken }), ids, scope.id))
        .returns(async () => result)
        .verifiable();
      expect(await getManager().computeSelection(imodelMock.object, ids, scope)).to.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

    it("forwards request to RpcRequestsHandler with scope as SelectionScope id", async () => {
      const ids = [createRandomId()];
      const scope = createRandomSelectionScope();
      const result = new KeySet();
      rpcRequestsHandlerMock
        .setup(async (x) => x.computeSelection(moq.It.isObjectWith({ imodel: imodelToken }), ids, scope.id))
        .returns(async () => result)
        .verifiable();
      expect(await getManager().computeSelection(imodelMock.object, ids, scope.id)).to.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

    it("forwards request to RpcRequestsHandler with ids as a single ID", async () => {
      const id = createRandomId();
      const scope = createRandomSelectionScope();
      const result = new KeySet();
      rpcRequestsHandlerMock
        .setup(async (x) => x.computeSelection(moq.It.isObjectWith({ imodel: imodelToken }), moq.It.is((a) => a.length === 1 && a[0] === id), scope.id))
        .returns(async () => result)
        .verifiable();
      expect(await getManager().computeSelection(imodelMock.object, id, scope.id)).to.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

    it("forwards request to RpcRequestsHandler with ids as Set<Id64String>", async () => {
      const id = createRandomId();
      const scope = createRandomSelectionScope();
      const result = new KeySet();
      rpcRequestsHandlerMock
        .setup(async (x) => x.computeSelection(moq.It.isObjectWith({ imodel: imodelToken }), moq.It.is((a) => a.length === 1 && a[0] === id), scope.id))
        .returns(async () => result)
        .verifiable();
      expect(await getManager().computeSelection(imodelMock.object, new Set([id]), scope.id)).to.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

  });

});
