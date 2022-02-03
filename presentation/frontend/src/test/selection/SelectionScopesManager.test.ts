/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as moq from "typemoq";
import type { Id64String } from "@itwin/core-bentley";
import type { IModelRpcProps } from "@itwin/core-common";
import type { IModelConnection } from "@itwin/core-frontend";
import type { RpcRequestsHandler } from "@itwin/presentation-common";
import { DEFAULT_KEYS_BATCH_SIZE, KeySet } from "@itwin/presentation-common";
import { createRandomECInstanceKey, createRandomId, createRandomSelectionScope } from "@itwin/presentation-common/lib/cjs/test";
import type { SelectionScopesManagerProps } from "../../presentation-frontend/selection/SelectionScopesManager";
import { SelectionScopesManager } from "../../presentation-frontend/selection/SelectionScopesManager";

describe("SelectionScopesManager", () => {

  const imodelToken = moq.Mock.ofType<IModelRpcProps>().object;
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
    imodelMock.setup((x) => x.getRpcProps()).returns(() => imodelToken);
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
        .returns(async () => result.toJSON())
        .verifiable();
      const computedResult = await getManager().computeSelection(imodelMock.object, ids, scope);
      rpcRequestsHandlerMock.verifyAll();
      expect(computedResult.size).to.eq(result.size);
      expect(computedResult.hasAll(result)).to.be.true;
    });

    it("forwards request to RpcRequestsHandler with scope as SelectionScope id", async () => {
      const ids = [createRandomId()];
      const scope = createRandomSelectionScope();
      const result = new KeySet();
      rpcRequestsHandlerMock
        .setup(async (x) => x.computeSelection(moq.It.isObjectWith({ imodel: imodelToken }), ids, scope.id))
        .returns(async () => result.toJSON())
        .verifiable();
      const computedResult = await getManager().computeSelection(imodelMock.object, ids, scope.id);
      rpcRequestsHandlerMock.verifyAll();
      expect(computedResult.size).to.eq(result.size);
      expect(computedResult.hasAll(result)).to.be.true;
    });

    it("forwards multiple requests to RpcRequestsHandler when ids count exceeds max batch size", async () => {
      const ids = new Array<Id64String>();
      for (let i = 0; i < (DEFAULT_KEYS_BATCH_SIZE + 1); ++i)
        ids.push(createRandomId());
      const scope = createRandomSelectionScope();
      const result1 = new KeySet([createRandomECInstanceKey()]);
      const result2 = new KeySet([createRandomECInstanceKey()]);
      rpcRequestsHandlerMock
        .setup(async (x) => x.computeSelection(moq.It.isObjectWith({ imodel: imodelToken }), moq.It.is((inIds: string[]): boolean => (inIds.length === DEFAULT_KEYS_BATCH_SIZE)), scope.id))
        .returns(async () => result1.toJSON())
        .verifiable();
      rpcRequestsHandlerMock
        .setup(async (x) => x.computeSelection(moq.It.isObjectWith({ imodel: imodelToken }), moq.It.is((inIds: string[]): boolean => (inIds.length === 1)), scope.id))
        .returns(async () => result2.toJSON())
        .verifiable();
      const computedResult = await getManager().computeSelection(imodelMock.object, ids, scope.id);
      rpcRequestsHandlerMock.verifyAll();
      expect(computedResult.size).to.eq(result1.size + result2.size);
      expect(computedResult.hasAll(result1)).to.be.true;
      expect(computedResult.hasAll(result2)).to.be.true;
    });

    it("forwards request to RpcRequestsHandler with ids as a single ID", async () => {
      const id = createRandomId();
      const scope = createRandomSelectionScope();
      const result = new KeySet();
      rpcRequestsHandlerMock
        .setup(async (x) => x.computeSelection(moq.It.isObjectWith({ imodel: imodelToken }), moq.It.is((a) => a.length === 1 && a[0] === id), scope.id))
        .returns(async () => result.toJSON())
        .verifiable();
      const computedResult = await getManager().computeSelection(imodelMock.object, id, scope);
      rpcRequestsHandlerMock.verifyAll();
      expect(computedResult.size).to.eq(result.size);
      expect(computedResult.hasAll(result)).to.be.true;
    });

    it("forwards request to RpcRequestsHandler with ids as Set<Id64String>", async () => {
      const id = createRandomId();
      const scope = createRandomSelectionScope();
      const result = new KeySet();
      rpcRequestsHandlerMock
        .setup(async (x) => x.computeSelection(moq.It.isObjectWith({ imodel: imodelToken }), moq.It.is((a) => a.length === 1 && a[0] === id), scope.id))
        .returns(async () => result.toJSON())
        .verifiable();
      const computedResult = await getManager().computeSelection(imodelMock.object, new Set([id]), scope);
      rpcRequestsHandlerMock.verifyAll();
      expect(computedResult.size).to.eq(result.size);
      expect(computedResult.hasAll(result)).to.be.true;
    });

  });

});
