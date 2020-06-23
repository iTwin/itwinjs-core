/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { BeEvent, IDisposable } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { HierarchyUpdateInfo, Ruleset } from "@bentley/presentation-common";
import { Presentation, PresentationManager, RulesetManager, RulesetVariablesManager } from "@bentley/presentation-frontend";
import { TreeDataChangesListener, TreeNodeItem } from "@bentley/ui-components";
import { renderHook } from "@testing-library/react-hooks";
import { IPresentationTreeDataProvider } from "../../../presentation-components";
import { PresentationTreeNodeLoaderProps, usePresentationTreeNodeLoader } from "../../../presentation-components/tree/controlled/TreeHooks";

describe("usePresentationNodeLoader", () => {

  let onHierarchyUpdateEvent: BeEvent<(ruleset: Ruleset, info: HierarchyUpdateInfo) => void>;
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const rulesetManagerMock = moq.Mock.ofType<RulesetManager>();
  const rulesetVariablesManagerMock = moq.Mock.ofType<RulesetVariablesManager>();
  const presentationManagerMock = moq.Mock.ofType<PresentationManager>();
  const initialProps = {
    imodel: imodelMock.object,
    ruleset: "test",
    pagingSize: 5,
  };

  beforeEach(() => {
    onHierarchyUpdateEvent = new BeEvent();
    rulesetVariablesManagerMock.reset();
    presentationManagerMock.reset();
    presentationManagerMock.setup((x) => x.onHierarchyUpdate).returns(() => onHierarchyUpdateEvent);
    presentationManagerMock.setup((x) => x.rulesets()).returns(() => rulesetManagerMock.object);
    presentationManagerMock.setup((x) => x.vars(moq.It.isAny())).returns(() => rulesetVariablesManagerMock.object);
    rulesetVariablesManagerMock.setup((x) => x.onVariableChanged).returns(() => new BeEvent());
    Presentation.setPresentationManager(presentationManagerMock.object);
  });

  afterEach(() => {
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

  it("creates a new nodeLoader when `PresentationManager` raises a related `onHierarchyUpdate` event and using ruleset id", () => {
    const ruleset: Ruleset = { id: initialProps.ruleset, rules: [] };
    const { result } = renderHook(
      (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
      { initialProps: { ...initialProps, ruleset: ruleset.id } },
    );
    const oldNodeLoader = result.current;

    onHierarchyUpdateEvent.raiseEvent(ruleset, "FULL");

    expect(result.current).to.not.eq(oldNodeLoader);
  });

  it("creates a new nodeLoader when `PresentationManager` raises a related `onHierarchyUpdate` event and using ruleset object", () => {
    const ruleset: Ruleset = { id: initialProps.ruleset, rules: [] };
    const { result } = renderHook(
      (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
      { initialProps: { ...initialProps, ruleset } },
    );

    const oldNodeLoader = result.current;
    onHierarchyUpdateEvent.raiseEvent(ruleset, "FULL");

    expect(result.current).to.not.eq(oldNodeLoader);
  });

  it("doesn't create a new nodeLoader when `PresentationManager` raises an unrelated `onHierarchyUpdate` event", () => {
    const { result } = renderHook(
      (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
      { initialProps },
    );
    const oldNodeLoader = result.current;

    const ruleset: Ruleset = { id: "unrelated", rules: [] };
    onHierarchyUpdateEvent.raiseEvent(ruleset, "FULL");

    expect(result.current).to.eq(oldNodeLoader);
  });

  it("starts preloading hierarchy", () => {
    presentationManagerMock.setup((x) => x.loadHierarchy(moq.It.isAny())).verifiable(moq.Times.once());
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
