/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as moq from "typemoq";
import { Id64String } from "@itwin/core-bentley";
import { IModelRpcProps } from "@itwin/core-common";
import { IModelConnection } from "@itwin/core-frontend";
import { DEFAULT_KEYS_BATCH_SIZE, ElementSelectionScopeProps, KeySet, RpcRequestsHandler } from "@itwin/presentation-common";
import { createRandomECInstanceKey, createRandomId, createRandomSelectionScope } from "@itwin/presentation-common/lib/cjs/test";
import { SelectionScopesManager, SelectionScopesManagerProps } from "../../presentation-frontend/selection/SelectionScopesManager";

describe("SelectionScopesManager", () => {
  const imodelToken = {} as IModelRpcProps;
  const imodel = {
    getRpcProps: () => imodelToken,
    key: "imodel-key",
  } as IModelConnection;
  const rpcRequestsHandlerMock = moq.Mock.ofType<RpcRequestsHandler>();
  let manager: SelectionScopesManager | undefined;
  let managerProps: SelectionScopesManagerProps;

  const getManager = () => {
    if (!manager) {
      manager = new SelectionScopesManager(managerProps);
    }
    return manager;
  };

  beforeEach(() => {
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
      expect(await getManager().getSelectionScopes(imodel)).to.eq(result);
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
      expect(await getManager().getSelectionScopes(imodel)).to.eq(result);
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
      expect(await getManager().getSelectionScopes(imodel, "de")).to.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });
  });

  describe("computeSelection", () => {
    it("forwards request to RpcRequestsHandler with scope as SelectionScope", async () => {
      const ids = [createRandomId()];
      const scope = createRandomSelectionScope();
      const result = new KeySet();
      rpcRequestsHandlerMock
        .setup(async (x) =>
          x.computeSelection(
            moq.It.is((options) => {
              return options.elementIds.length === 1 && options.elementIds[0] === ids[0] && options.scope.id === scope.id;
            }),
          ),
        )
        .returns(async () => result.toJSON())
        .verifiable();
      const computedResult = await getManager().computeSelection(imodel, ids, scope);
      rpcRequestsHandlerMock.verifyAll();
      expect(computedResult.size).to.eq(result.size);
      expect(computedResult.hasAll(result)).to.be.true;
    });

    it("forwards request to RpcRequestsHandler with scope as SelectionScope id", async () => {
      const ids = [createRandomId()];
      const scope = createRandomSelectionScope();
      const result = new KeySet();
      rpcRequestsHandlerMock
        .setup(async (x) =>
          x.computeSelection(
            moq.It.is((options) => {
              return options.elementIds.length === 1 && options.elementIds[0] === ids[0] && options.scope.id === scope.id;
            }),
          ),
        )
        .returns(async () => result.toJSON())
        .verifiable();
      const computedResult = await getManager().computeSelection(imodel, ids, scope.id);
      rpcRequestsHandlerMock.verifyAll();
      expect(computedResult.size).to.eq(result.size);
      expect(computedResult.hasAll(result)).to.be.true;
    });

    it("forwards request to RpcRequestsHandler with element scope and params", async () => {
      const elementIds = [createRandomId()];
      const scope: ElementSelectionScopeProps = {
        id: "element",
        ancestorLevel: 123,
      };
      const result = new KeySet();
      rpcRequestsHandlerMock
        .setup(async (x) =>
          x.computeSelection(
            moq.It.is((options) => {
              return (
                options.elementIds.length === 1 &&
                options.elementIds[0] === elementIds[0] &&
                options.scope.id === scope.id &&
                (options.scope as ElementSelectionScopeProps).ancestorLevel === scope.ancestorLevel
              );
            }),
          ),
        )
        .returns(async () => result.toJSON())
        .verifiable();
      const computedResult = await getManager().computeSelection(imodel, elementIds, scope);
      rpcRequestsHandlerMock.verifyAll();
      expect(computedResult.size).to.eq(result.size);
      expect(computedResult.hasAll(result)).to.be.true;
    });

    it("forwards multiple requests to RpcRequestsHandler when ids count exceeds max batch size", async () => {
      const ids = new Array<Id64String>();
      for (let i = 0; i < DEFAULT_KEYS_BATCH_SIZE + 1; ++i) {
        ids.push(createRandomId());
      }
      const scope = createRandomSelectionScope();
      const result1 = new KeySet([createRandomECInstanceKey()]);
      const result2 = new KeySet([createRandomECInstanceKey()]);
      rpcRequestsHandlerMock
        .setup(async (x) =>
          x.computeSelection(
            moq.It.is((options) => {
              return options.elementIds.length === DEFAULT_KEYS_BATCH_SIZE && options.scope.id === scope.id;
            }),
          ),
        )
        .returns(async () => result1.toJSON())
        .verifiable();
      rpcRequestsHandlerMock
        .setup(async (x) =>
          x.computeSelection(
            moq.It.is((options) => {
              return options.elementIds.length === 1 && options.scope.id === scope.id;
            }),
          ),
        )
        .returns(async () => result2.toJSON())
        .verifiable();
      const computedResult = await getManager().computeSelection(imodel, ids, scope.id);
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
        .setup(async (x) =>
          x.computeSelection(
            moq.It.is((options) => {
              return options.elementIds.length === 1 && options.elementIds[0] === id && options.scope.id === scope.id;
            }),
          ),
        )
        .returns(async () => result.toJSON())
        .verifiable();
      const computedResult = await getManager().computeSelection(imodel, id, scope);
      rpcRequestsHandlerMock.verifyAll();
      expect(computedResult.size).to.eq(result.size);
      expect(computedResult.hasAll(result)).to.be.true;
    });

    it("forwards request to RpcRequestsHandler with ids as Set<Id64String>", async () => {
      const id = createRandomId();
      const scope = createRandomSelectionScope();
      const result = new KeySet();
      rpcRequestsHandlerMock
        .setup(async (x) =>
          x.computeSelection(
            moq.It.is((options) => {
              return options.elementIds.length === 1 && options.elementIds[0] === id && options.scope.id === scope.id;
            }),
          ),
        )
        .returns(async () => result.toJSON())
        .verifiable();
      const computedResult = await getManager().computeSelection(imodel, new Set([id]), scope);
      rpcRequestsHandlerMock.verifyAll();
      expect(computedResult.size).to.eq(result.size);
      expect(computedResult.hasAll(result)).to.be.true;
    });
  });
});
