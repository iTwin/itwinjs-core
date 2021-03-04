/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { BeEvent, IDisposable } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { RegisteredRuleset, Ruleset, VariableValue, VariableValueTypes } from "@bentley/presentation-common";
import { IModelHierarchyChangeEventArgs, Presentation, PresentationManager, RulesetVariablesManager } from "@bentley/presentation-frontend";
import { PropertyRecord } from "@bentley/ui-abstract";
import { TreeDataChangesListener, TreeModelNodeInput, TreeNodeItem } from "@bentley/ui-components";
import { cleanup, renderHook } from "@testing-library/react-hooks";
import { IPresentationTreeDataProvider } from "../../../presentation-components";
import { PresentationTreeNodeLoaderProps, usePresentationTreeNodeLoader } from "../../../presentation-components/tree/controlled/TreeHooks";
import { createRandomTreeNodeItem, mockPresentationManager } from "../../_helpers/UiComponents";

describe("usePresentationNodeLoader", () => {

  let onIModelHierarchyChanged: BeEvent<(args: IModelHierarchyChangeEventArgs) => void>;
  let onRulesetModified: BeEvent<(curr: RegisteredRuleset, prev: Ruleset) => void>;
  let onRulesetVariableChanged: BeEvent<(variableId: string, prevValue: VariableValue, currValue: VariableValue) => void>;
  let presentationManagerMock: moq.IMock<PresentationManager>;
  let rulesetVariablesManagerMock: moq.IMock<RulesetVariablesManager>;
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const rulesetId = "test-ruleset-id";
  const imodelKey = "test-imodel-key";
  const initialProps: PresentationTreeNodeLoaderProps = {
    imodel: imodelMock.object,
    ruleset: rulesetId,
    pagingSize: 5,
  };

  beforeEach(() => {
    imodelMock.reset();
    imodelMock.setup((x) => x.key).returns(() => imodelKey);
    const mocks = mockPresentationManager();
    presentationManagerMock = mocks.presentationManager;
    rulesetVariablesManagerMock = mocks.rulesetVariablesManager;
    onIModelHierarchyChanged = mocks.presentationManager.object.onIModelHierarchyChanged;
    onRulesetModified = mocks.rulesetsManager.object.onRulesetModified;
    onRulesetVariableChanged = mocks.rulesetVariablesManager.object.onVariableChanged;
    mocks.presentationManager.setup((x) => x.stateTracker).returns(() => undefined);
    Presentation.setPresentationManager(mocks.presentationManager.object);
  });

  afterEach(async () => {
    await cleanup();
    Presentation.terminate();
  });

  it("creates node loader", () => {
    const { result } = renderHook(
      (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
      { initialProps },
    );

    expect(result.current).to.not.be.undefined;
  });

  it("creates new nodeLoader when imodel changes", () => {
    const { result, rerender } = renderHook(
      (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
      { initialProps },
    );
    const oldNodeLoader = result.current;

    const newImodelMock = moq.Mock.ofType<IModelConnection>();
    rerender({ ...initialProps, imodel: newImodelMock.object });

    expect(result.current).to.not.eq(oldNodeLoader);
  });

  it("creates new nodeLoader when rulesetId changes", () => {
    const { result, rerender } = renderHook(
      (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
      { initialProps },
    );
    const oldNodeLoader = result.current;

    rerender({ ...initialProps, ruleset: "changed" });

    expect(result.current).to.not.eq(oldNodeLoader);
  });

  it("creates new nodeLoader when pagingSize changes", () => {
    const { result, rerender } = renderHook(
      (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
      { initialProps },
    );
    const oldNodeLoader = result.current;

    rerender({ ...initialProps, pagingSize: 20 });

    expect(result.current).to.not.eq(oldNodeLoader);
  });

  describe("auto-updating model source", () => {

    beforeEach(() => {
      initialProps.enableHierarchyAutoUpdate = true;
    });

    it("doesn't create a new nodeLoader when `PresentationManager` raises `onIModelHierarchyChanged` event with unrelated ruleset", () => {
      const { result } = renderHook(
        (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
        { initialProps },
      );
      const oldNodeLoader = result.current;

      onIModelHierarchyChanged.raiseEvent({ rulesetId: "unrelated", updateInfo: "FULL", imodelKey });

      expect(result.current).to.eq(oldNodeLoader);
    });

    it("doesn't create a new nodeLoader when `PresentationManager` raises `onIModelHierarchyChanged` event with unrelated imodel", () => {
      const { result } = renderHook(
        (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
        { initialProps },
      );
      const oldNodeLoader = result.current;

      onIModelHierarchyChanged.raiseEvent({ rulesetId, updateInfo: "FULL", imodelKey: "unrelated" });

      expect(result.current).to.eq(oldNodeLoader);
    });

    it("creates a new nodeLoader when `PresentationManager` raises a related `onIModelHierarchyChanged` event with FULL hierarchy update", () => {
      const { result } = renderHook(
        (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
        { initialProps: { ...initialProps, ruleset: rulesetId } },
      );
      const oldNodeLoader = result.current;

      onIModelHierarchyChanged.raiseEvent({ rulesetId, updateInfo: "FULL", imodelKey });

      expect(result.current).to.not.eq(oldNodeLoader);
    });

    it("creates a new nodeLoader when `PresentationManager` raises a related `onIModelHierarchyChanged` event with partial hierarchy updates", () => {
      const { result } = renderHook(
        (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
        { initialProps: { ...initialProps, ruleset: rulesetId } },
      );
      const oldNodeLoader = result.current;

      onIModelHierarchyChanged.raiseEvent({ rulesetId, updateInfo: [], imodelKey });

      expect(result.current).to.not.eq(oldNodeLoader);
    });

    it("doesn't create a new nodeLoader when `RulesetsManager` raises an unrelated `onRulesetModified` event", () => {
      const { result } = renderHook(
        (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
        { initialProps },
      );
      const oldNodeLoader = result.current;

      const currRuleset = new RegisteredRuleset({ id: "unrelated", rules: [] }, "", () => { });
      onRulesetModified.raiseEvent(currRuleset, { ...currRuleset.toJSON() });

      expect(result.current).to.eq(oldNodeLoader);
    });

    it("creates a new nodeLoader when `RulesetsManager` raises a related `onRulesetModified` event", async () => {
      const { result, waitForValueToChange } = renderHook(
        (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
        { initialProps },
      );
      const oldNodeLoader = result.current;

      const currRuleset = new RegisteredRuleset({ id: rulesetId, rules: [] }, "", () => { });
      presentationManagerMock
        .setup(async (x) => x.compareHierarchies({
          imodel: imodelMock.object,
          prev: {
            rulesetOrId: currRuleset.toJSON(),
          },
          rulesetOrId: currRuleset.toJSON(),
          expandedNodeKeys: [],
        }))
        .returns(async () => [])
        .verifiable();
      onRulesetModified.raiseEvent(currRuleset, currRuleset.toJSON());

      await waitForValueToChange(() => result.current !== oldNodeLoader);
      expect(result.current).to.not.eq(oldNodeLoader);

      presentationManagerMock.verifyAll();
    });

    it("creates a new nodeLoader when `RulesetVariablesManager` raises an `onRulesetVariableChanged` event", async () => {
      const { result, waitForValueToChange } = renderHook(
        (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
        { initialProps },
      );
      const oldNodeLoader = result.current;

      const variables = [{ id: "var-id", type: VariableValueTypes.String, value: "curr" }, { id: "other-var", type: VariableValueTypes.Int, value: 123 }];

      presentationManagerMock
        .setup(async (x) => x.compareHierarchies({
          imodel: imodelMock.object,
          prev: {
            rulesetVariables: [
              { ...variables[0], value: "prev" },
              variables[1],
            ],
          },
          rulesetOrId: rulesetId,
          expandedNodeKeys: [],
        }))
        .returns(async () => [])
        .verifiable();
      rulesetVariablesManagerMock.setup(async (x) => x.getAllVariables()).returns(async () => variables);

      onRulesetVariableChanged.raiseEvent("var-id", "prev", "curr");

      await waitForValueToChange(() => result.current !== oldNodeLoader);
      expect(result.current).to.not.eq(oldNodeLoader);

      presentationManagerMock.verifyAll();
    });

    it("sends visible expanded nodes when comparing hierarchies due to ruleset modification", async () => {
      const { result, waitForValueToChange } = renderHook(
        (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
        { initialProps },
      );
      const oldNodeLoader = result.current;

      const createTreeModelNodeInput = (id: string, isExpanded: boolean): TreeModelNodeInput => ({
        id,
        label: PropertyRecord.fromString(id),
        item: createRandomTreeNodeItem(),
        isExpanded,
        isLoading: false,
        numChildren: 1,
        isSelected: false,
      });
      const a = createTreeModelNodeInput("a", true);
      const b = createTreeModelNodeInput("b", true);
      const c = createTreeModelNodeInput("c", false);
      const d = createTreeModelNodeInput("d", true);
      result.current.modelSource.modifyModel((model) => {
        model.setChildren(undefined, [a], 0);
        model.setChildren(a.id, [b, c], 0);
        model.setChildren(c.id, [d], 0);
      });

      const currRuleset = new RegisteredRuleset({ id: rulesetId, rules: [] }, "", () => { });
      presentationManagerMock
        .setup(async (x) => x.compareHierarchies({
          imodel: imodelMock.object,
          prev: {
            rulesetOrId: currRuleset.toJSON(),
          },
          rulesetOrId: currRuleset.toJSON(),
          expandedNodeKeys: [
            result.current.dataProvider.getNodeKey(a.item),
            result.current.dataProvider.getNodeKey(b.item),
          ],
        }))
        .returns(async () => [])
        .verifiable();
      onRulesetModified.raiseEvent(currRuleset, currRuleset.toJSON());

      await waitForValueToChange(() => result.current !== oldNodeLoader);
      expect(result.current).to.not.eq(oldNodeLoader);

      presentationManagerMock.verifyAll();
    });

  });

  it("starts preloading hierarchy", () => {
    presentationManagerMock.setup(async (x) => x.loadHierarchy(moq.It.isAny())).verifiable(moq.Times.once());
    renderHook(
      (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
      { initialProps: { ...initialProps, preloadingEnabled: true } },
    );
    presentationManagerMock.verifyAll();
  });

  it("uses supplied dataProvider", () => {
    // dispatch function from useState hook does not work with mocked object because it is function
    const dataProvider: IPresentationTreeDataProvider = {
      imodel: imodelMock.object,
      rulesetId: "",
      onTreeNodeChanged: new BeEvent<TreeDataChangesListener>(),
      dispose: () => { },
      getFilteredNodePaths: async () => [],
      getNodeKey: (node: TreeNodeItem) => (node as any).__key,
      getNodesCount: async () => 0,
      getNodes: async () => [],
      loadHierarchy: async () => { },
    };
    const { result } = renderHook(
      (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
      { initialProps: { ...initialProps, dataProvider } },
    );
    expect(result.current.dataProvider).to.be.eq(dataProvider);
  });

  it("uses supplied disposable dataProvider and disposes it on unmount", () => {
    // dispatch function from useState hook does not work with mocked object because it is function
    const dataProvider: IPresentationTreeDataProvider & IDisposable = {
      imodel: imodelMock.object,
      rulesetId: "",
      onTreeNodeChanged: new BeEvent<TreeDataChangesListener>(),
      getFilteredNodePaths: async () => [],
      getNodeKey: (node: TreeNodeItem) => (node as any).__key,
      getNodesCount: async () => 0,
      getNodes: async () => [],
      loadHierarchy: async () => { },
      dispose: sinon.spy(),
    };
    const { result, unmount } = renderHook(
      (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
      { initialProps: { ...initialProps, dataProvider } },
    );
    expect(result.current.dataProvider).to.be.eq(dataProvider);
    expect(dataProvider.dispose).to.not.be.called;
    unmount();
    expect(dataProvider.dispose).to.be.calledOnce;
  });

});
