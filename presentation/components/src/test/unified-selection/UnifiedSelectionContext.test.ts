/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { KeySet } from "@bentley/presentation-common";
import { Presentation, SelectionManager } from "@bentley/presentation-frontend";
import { act, renderHook, RenderHookResult } from "@testing-library/react-hooks";
import {
  UnifiedSelectionContext, UnifiedSelectionContextProvider, UnifiedSelectionContextProviderProps, useUnifiedSelectionContext,
} from "../../presentation-components/unified-selection/UnifiedSelectionContext";

describe("UnifiedSelectionContext", () => {
  const testIModel = {} as IModelConnection;

  function renderUnifiedSelectionContextHook(
    imodel = {} as IModelConnection,
    selectionLevel?: number,
  ): RenderHookResult<UnifiedSelectionContextProviderProps, UnifiedSelectionContext> {
    return renderHook(
      () => useUnifiedSelectionContext()!,
      {
        wrapper: UnifiedSelectionContextProvider,
        initialProps: { imodel, selectionLevel } as UnifiedSelectionContextProviderProps,
      },
    );
  }

  beforeEach(() => {
    const selectionManager = new SelectionManager({ scopes: undefined as any });
    sinon.stub(Presentation, "selection").get(() => selectionManager);
  });

  afterEach(() => {
    sinon.restore();
  });

  it("uses selection level 0 by default", () => {
    const { result } = renderUnifiedSelectionContextHook();
    expect(result.current.selectionLevel).to.be.equal(0);
  });

  it("updates context when receives different imodel connection", () => {
    const { rerender, result } = renderUnifiedSelectionContextHook();
    const firstResult = result.current;

    const updatedImodel = {} as IModelConnection;
    rerender({ imodel: updatedImodel });
    const secondResult = result.current;

    expect(firstResult).not.to.be.equal(secondResult);
    expect(firstResult.getSelection).not.to.be.equal(secondResult.getSelection);
    expect(firstResult.replaceSelection).not.to.be.equal(secondResult.replaceSelection);
    expect(firstResult.addToSelection).not.to.be.equal(secondResult.addToSelection);
    expect(firstResult.clearSelection).not.to.be.equal(secondResult.clearSelection);
    expect(firstResult.removeFromSelection).not.to.be.equal(secondResult.removeFromSelection);
  });

  it("updates context when receives different selection level", () => {
    const { rerender, result } = renderUnifiedSelectionContextHook();
    const firstResult = result.current;

    rerender({ imodel: result.current.imodel, selectionLevel: 1 });
    const secondResult = result.current;

    expect(firstResult).not.to.be.equal(secondResult);
    expect(firstResult.getSelection).not.to.be.equal(secondResult.getSelection);
    expect(firstResult.replaceSelection).not.to.be.equal(secondResult.replaceSelection);
    expect(firstResult.addToSelection).not.to.be.equal(secondResult.addToSelection);
    expect(firstResult.clearSelection).not.to.be.equal(secondResult.clearSelection);
    expect(firstResult.removeFromSelection).not.to.be.equal(secondResult.removeFromSelection);
  });

  it("updates context when current selection changes", () => {
    const { result } = renderUnifiedSelectionContextHook(testIModel);
    const firstResult = result.current;

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    act(() => { Presentation.selection.addToSelection("", testIModel, [{ className: "test", id: "1" }], 0); });
    const secondResult = result.current;

    expect(firstResult).not.to.be.equal(secondResult);
    expect(firstResult.getSelection).not.to.be.equal(secondResult.getSelection);
    expect(firstResult.replaceSelection).to.be.equal(secondResult.replaceSelection);
    expect(firstResult.addToSelection).to.be.equal(secondResult.addToSelection);
    expect(firstResult.clearSelection).to.be.equal(secondResult.clearSelection);
    expect(firstResult.removeFromSelection).to.be.equal(secondResult.removeFromSelection);
  });

  it("updates context when selection changes on one level above", () => {
    const { result } = renderUnifiedSelectionContextHook(testIModel, 1);
    const firstResult = result.current;

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    act(() => { Presentation.selection.addToSelection("", testIModel, [{ className: "test", id: "1" }], 0); });
    const secondResult = result.current;

    expect(firstResult).not.to.be.equal(secondResult);
    expect(firstResult.getSelection).not.to.be.equal(secondResult.getSelection);
    expect(firstResult.replaceSelection).to.be.equal(secondResult.replaceSelection);
    expect(firstResult.addToSelection).to.be.equal(secondResult.addToSelection);
    expect(firstResult.clearSelection).to.be.equal(secondResult.clearSelection);
    expect(firstResult.removeFromSelection).to.be.equal(secondResult.removeFromSelection);
  });

  it("does not update context when selection changes one level deeper", () => {
    const { result } = renderUnifiedSelectionContextHook(testIModel);
    const firstResult = result.current;

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    act(() => { Presentation.selection.addToSelection("", testIModel, [{ className: "test", id: "1" }], 1); });
    const secondResult = result.current;

    expect(firstResult.getSelection).to.be.equal(secondResult.getSelection);
  });

  describe("context", () => {
    const keys = new KeySet();

    describe("getSelection", () => {
      let stubGetSelection: sinon.SinonStub<[IModelConnection, number?], Readonly<KeySet>>;

      beforeEach(() => {
        stubGetSelection = sinon.stub(Presentation.selection, "getSelection").returns(keys);
      });

      it("gets current selection", () => {
        const { result } = renderUnifiedSelectionContextHook(testIModel);
        result.current.getSelection(10);
        expect(stubGetSelection).to.have.been.calledOnceWithExactly(testIModel, 10);
      });

      it("makes KeySet reference be different from global KeySet", () => {
        const { result } = renderUnifiedSelectionContextHook(testIModel);
        const returnedKeySet = result.current.getSelection();
        expect(returnedKeySet).not.to.be.equal(keys);
      });

      it("returns same KeySet reference for same selection level", () => {
        const { result } = renderUnifiedSelectionContextHook(testIModel);
        const firstKeySet = result.current.getSelection(10);
        const secondKeySet = result.current.getSelection(10);
        expect(firstKeySet).to.be.equal(secondKeySet);
      });

      it("returns different KeySet reference for different selection level", () => {
        const { result } = renderUnifiedSelectionContextHook(testIModel);
        const firstKeySet = result.current.getSelection(10);
        const secondKeySet = result.current.getSelection(9);
        expect(firstKeySet).not.to.be.equal(secondKeySet);
      });

      it("returns different KeySet reference after selection changes", () => {
        const { result } = renderUnifiedSelectionContextHook(testIModel);
        const firstKeySet = result.current.getSelection();

        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        act(() => result.current.addToSelection([{ className: "test", id: "1" }]));
        const secondKeySet = result.current.getSelection();

        expect(firstKeySet).not.to.be.equal(secondKeySet);
      });

      it("returns a working KeySet", () => {
        stubGetSelection.restore();
        const { result } = renderUnifiedSelectionContextHook(testIModel);

        const key = { className: "test", id: "1" };
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        act(() => result.current.addToSelection([key]));

        const returnedKeySet = result.current.getSelection();
        expect(returnedKeySet.has(key)).to.be.true;
      });
    });

    it("replaces current selection", () => {
      const { result } = renderUnifiedSelectionContextHook(testIModel);
      const stub = sinon.stub(Presentation.selection, "replaceSelection").returns();
      result.current.replaceSelection(keys, 10);
      expect(stub).to.have.been.calledOnceWithExactly("UnifiedSelectionContext", testIModel, keys, 10);
    });

    it("adds to current selection", () => {
      const { result } = renderUnifiedSelectionContextHook(testIModel);
      const stub = sinon.stub(Presentation.selection, "addToSelection").returns();
      result.current.addToSelection(keys, 10);
      expect(stub).to.have.been.calledOnceWithExactly("UnifiedSelectionContext", testIModel, keys, 10);
    });

    it("clears current selection", () => {
      const { result } = renderUnifiedSelectionContextHook(testIModel);
      const stub = sinon.stub(Presentation.selection, "clearSelection").returns();
      result.current.clearSelection(10);
      expect(stub).to.have.been.calledOnceWithExactly("UnifiedSelectionContext", testIModel, 10);
    });

    it("removes from current selection", () => {
      const { result } = renderUnifiedSelectionContextHook(testIModel);
      const stub = sinon.stub(Presentation.selection, "removeFromSelection").returns();
      result.current.removeFromSelection(keys, 10);
      expect(stub).to.have.been.calledOnceWithExactly("UnifiedSelectionContext", testIModel, keys, 10);
    });

    it("uses default selection level when one is not specified", () => {
      const { result } = renderUnifiedSelectionContextHook(testIModel, 4);

      const stubGetSelection = sinon.stub(Presentation.selection, "getSelection").returns(keys);
      result.current.getSelection();
      expect(stubGetSelection).to.have.been.calledOnceWithExactly(testIModel, 4);

      const stubReplaceSelection = sinon.stub(Presentation.selection, "replaceSelection").returns();
      result.current.replaceSelection(keys);
      expect(stubReplaceSelection).to.have.been.calledOnceWithExactly("UnifiedSelectionContext", testIModel, keys, 4);

      const stubAddToSelection = sinon.stub(Presentation.selection, "addToSelection").returns();
      result.current.addToSelection(keys);
      expect(stubAddToSelection).to.have.been.calledOnceWithExactly("UnifiedSelectionContext", testIModel, keys, 4);

      const stubClearSelection = sinon.stub(Presentation.selection, "clearSelection").returns();
      result.current.clearSelection();
      expect(stubClearSelection).to.have.been.calledOnceWithExactly("UnifiedSelectionContext", testIModel, 4);

      const stubRemoveFromSelection = sinon.stub(Presentation.selection, "removeFromSelection").returns();
      result.current.removeFromSelection(keys);
      expect(stubRemoveFromSelection).to.have.been.calledOnceWithExactly("UnifiedSelectionContext", testIModel, keys, 4);
    });
  });

  describe("useUnifiedSelectionContext", () => {
    it("returns `undefined` context when there is no unified selection context", () => {
      const { result } = renderHook(() => useUnifiedSelectionContext());
      expect(result.current).to.be.undefined;
    });
  });
});
