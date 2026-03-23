/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/no-deprecated */

import { expect } from "chai";
import sinon from "sinon";
import { Id64String } from "@itwin/core-bentley";
import { IModelRpcProps } from "@itwin/core-common";
import { IModelConnection } from "@itwin/core-frontend";
import { DEFAULT_KEYS_BATCH_SIZE, ElementSelectionScopeProps, KeySet, SelectionScope } from "@itwin/presentation-common";
import { RpcRequestsHandler } from "@itwin/presentation-common/internal";
import { createTestECInstanceKey } from "@itwin/presentation-common/test-utils";
import { SelectionScopesManager, SelectionScopesManagerProps } from "../../presentation-frontend/selection/SelectionScopesManager.js";

describe("SelectionScopesManager", () => {
  const imodelToken = {} as IModelRpcProps;
  const imodel = {
    getRpcProps: () => imodelToken,
    key: "imodel-key",
  } as IModelConnection;
  let rpcRequestsHandlerMock: ReturnType<typeof stubRpcRequestsHandler>;
  let rpcRequestsHandler: RpcRequestsHandler;
  let manager: SelectionScopesManager | undefined;
  let managerProps: SelectionScopesManagerProps;

  const getManager = () => {
    if (!manager) {
      manager = new SelectionScopesManager(managerProps);
    }
    return manager;
  };

  beforeEach(() => {
    rpcRequestsHandlerMock = stubRpcRequestsHandler();
    rpcRequestsHandler = rpcRequestsHandlerMock as unknown as RpcRequestsHandler;
    manager = undefined;
    managerProps = {
      rpcRequestsHandler,
    };
  });

  function stubRpcRequestsHandler() {
    return {
      getSelectionScopes: sinon.stub(),
      computeSelection: sinon.stub(),
    };
  }

  describe("activeScope", () => {
    it("gets and sets active scope as string", () => {
      expect(getManager().activeScope).to.be.undefined;
      getManager().activeScope = "test";
      expect(getManager().activeScope).to.eq("test");
    });

    it("gets and sets active scope as SelectionScope", () => {
      expect(getManager().activeScope).to.be.undefined;
      const scope = "element";
      getManager().activeScope = scope;
      expect(getManager().activeScope).to.eq(scope);
    });
  });

  describe("getSelectionScopes", () => {
    it("forwards request to RpcRequestsHandler", async () => {
      const result: SelectionScope[] = [{ id: "element", label: "Element" }];
      rpcRequestsHandlerMock.getSelectionScopes.resolves(result);
      expect(await getManager().getSelectionScopes(imodel)).to.eq(result);
      expect(rpcRequestsHandlerMock.getSelectionScopes).to.have.been.calledOnceWith(sinon.match({ imodel: imodelToken, locale: undefined }));
    });

    it("passes locale provided by localeProvider when request locale is not set", async () => {
      managerProps = {
        ...managerProps,
        localeProvider: () => "lt",
      };
      const result: SelectionScope[] = [{ id: "element", label: "Element" }];
      rpcRequestsHandlerMock.getSelectionScopes.resolves(result);
      expect(await getManager().getSelectionScopes(imodel)).to.eq(result);
      expect(rpcRequestsHandlerMock.getSelectionScopes).to.have.been.calledOnceWith(sinon.match({ imodel: imodelToken, locale: "lt" }));
    });

    it("passes request locale when set", async () => {
      managerProps = {
        ...managerProps,
        localeProvider: () => "lt",
      };
      const result: SelectionScope[] = [{ id: "element", label: "Element" }];
      rpcRequestsHandlerMock.getSelectionScopes.resolves(result);
      expect(await getManager().getSelectionScopes(imodel, "de")).to.eq(result);
      expect(rpcRequestsHandlerMock.getSelectionScopes).to.have.been.calledOnceWith(sinon.match({ imodel: imodelToken, locale: "de" }));
    });
  });

  describe("computeSelection", () => {
    it("forwards request to RpcRequestsHandler with scope as SelectionScope", async () => {
      const ids = ["0x123"];
      const scope: SelectionScope = { id: "element", label: "Element" };
      const result = new KeySet();
      rpcRequestsHandlerMock.computeSelection.resolves(result.toJSON());
      const computedResult = await getManager().computeSelection(imodel, ids, scope);
      expect(rpcRequestsHandlerMock.computeSelection).to.have.been.calledOnceWith(
        sinon.match((options) => {
          return options.elementIds.length === 1 && options.elementIds[0] === ids[0] && options.scope.id === scope.id;
        }),
      );
      expect(computedResult.size).to.eq(result.size);
      expect(computedResult.hasAll(result)).to.be.true;
    });

    it("forwards request to RpcRequestsHandler with scope as SelectionScope id", async () => {
      const ids = ["0x123"];
      const scope: SelectionScope = { id: "element", label: "Element" };
      const result = new KeySet();
      rpcRequestsHandlerMock.computeSelection.resolves(result.toJSON());
      const computedResult = await getManager().computeSelection(imodel, ids, scope.id);
      expect(rpcRequestsHandlerMock.computeSelection).to.have.been.calledOnceWith(
        sinon.match((options) => {
          return options.elementIds.length === 1 && options.elementIds[0] === ids[0] && options.scope.id === scope.id;
        }),
      );
      expect(computedResult.size).to.eq(result.size);
      expect(computedResult.hasAll(result)).to.be.true;
    });

    it("forwards request to RpcRequestsHandler with element scope and params", async () => {
      const elementIds = ["0x123"];
      const scope: ElementSelectionScopeProps = {
        id: "element",
        ancestorLevel: 123,
      };
      const result = new KeySet();
      rpcRequestsHandlerMock.computeSelection.resolves(result.toJSON());
      const computedResult = await getManager().computeSelection(imodel, elementIds, scope);
      expect(rpcRequestsHandlerMock.computeSelection).to.have.been.calledOnceWith(
        sinon.match((options) => {
          return (
            options.elementIds.length === 1 &&
            options.elementIds[0] === elementIds[0] &&
            options.scope.id === scope.id &&
            (options.scope as ElementSelectionScopeProps).ancestorLevel === scope.ancestorLevel
          );
        }),
      );
      expect(computedResult.size).to.eq(result.size);
      expect(computedResult.hasAll(result)).to.be.true;
    });

    it("forwards multiple requests to RpcRequestsHandler when ids count exceeds max batch size", async () => {
      const ids = new Array<Id64String>();
      for (let i = 0; i < DEFAULT_KEYS_BATCH_SIZE + 1; ++i) {
        ids.push("0x123");
      }
      const scope: SelectionScope = { id: "element", label: "Element" };
      const result1 = new KeySet([createTestECInstanceKey({ id: "0x111" })]);
      const result2 = new KeySet([createTestECInstanceKey({ id: "0x222" })]);
      rpcRequestsHandlerMock.computeSelection
        .withArgs(
          sinon.match((options) => {
            return options.elementIds.length === DEFAULT_KEYS_BATCH_SIZE && options.scope.id === scope.id;
          }),
        )
        .resolves(result1.toJSON());
      rpcRequestsHandlerMock.computeSelection
        .withArgs(
          sinon.match((options) => {
            return options.elementIds.length === 1 && options.scope.id === scope.id;
          }),
        )
        .resolves(result2.toJSON());
      const computedResult = await getManager().computeSelection(imodel, ids, scope.id);
      expect(rpcRequestsHandlerMock.computeSelection).to.have.been.calledTwice;
      expect(computedResult.size).to.eq(result1.size + result2.size);
      expect(computedResult.hasAll(result1)).to.be.true;
      expect(computedResult.hasAll(result2)).to.be.true;
    });

    it("forwards request to RpcRequestsHandler with ids as a single ID", async () => {
      const id = "0x123";
      const scope: SelectionScope = { id: "element", label: "Element" };
      const result = new KeySet();
      rpcRequestsHandlerMock.computeSelection.resolves(result.toJSON());
      const computedResult = await getManager().computeSelection(imodel, id, scope);
      expect(rpcRequestsHandlerMock.computeSelection).to.have.been.calledOnceWith(
        sinon.match((options) => {
          return options.elementIds.length === 1 && options.elementIds[0] === id && options.scope.id === scope.id;
        }),
      );
      expect(computedResult.size).to.eq(result.size);
      expect(computedResult.hasAll(result)).to.be.true;
    });

    it("forwards request to RpcRequestsHandler with ids as Set<Id64String>", async () => {
      const id = "0x123";
      const scope: SelectionScope = { id: "element", label: "Element" };
      const result = new KeySet();
      rpcRequestsHandlerMock.computeSelection.resolves(result.toJSON());
      const computedResult = await getManager().computeSelection(imodel, new Set([id]), scope);
      expect(rpcRequestsHandlerMock.computeSelection).to.have.been.calledOnceWith(
        sinon.match((options) => {
          return options.elementIds.length === 1 && options.elementIds[0] === id && options.scope.id === scope.id;
        }),
      );
      expect(computedResult.size).to.eq(result.size);
      expect(computedResult.hasAll(result)).to.be.true;
    });
  });
});
