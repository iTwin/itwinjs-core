/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import sinon from "sinon";
import * as moq from "typemoq";
import { renderHook } from "@testing-library/react-hooks";
import { BeUiEvent } from "@bentley/bentleyjs-core";
import { useVisibleTreeNodes, usePagedNodeLoader, useModelSource, useNodeLoader } from "../../../ui-components/tree/controlled/TreeHooks";
import { VisibleTreeNodes, TreeModel, MutableTreeModel } from "../../../ui-components/tree/controlled/TreeModel";
import { TreeModelSource } from "../../../ui-components/tree/controlled/TreeModelSource";
import { ITreeNodeLoader, LoadedNodeHierarchy } from "../../../ui-components/tree/controlled/TreeNodeLoader";
import { TreeDataProviderRaw, TreeDataProvider } from "../../../ui-components/tree/TreeDataProvider";

// tslint:disable: react-hooks-nesting
describe("useVisibleTreeNodes", () => {
  const modelSourceMock = moq.Mock.ofType<TreeModelSource>();
  const onModelChangeMock = moq.Mock.ofType<BeUiEvent<TreeModel>>();
  const testVisibleNodes: VisibleTreeNodes = {
    getAtIndex: () => undefined,
    getModel: () => new MutableTreeModel(),
    getNumNodes: () => 0,
    getNumRootNodes: () => 0,
    [Symbol.iterator]: () => [][Symbol.iterator](),
  };

  beforeEach(() => {
    modelSourceMock.reset();
    onModelChangeMock.reset();

    modelSourceMock.setup((x) => x.onModelChanged).returns(() => onModelChangeMock.object);
    modelSourceMock.setup((x) => x.getVisibleNodes()).returns(() => testVisibleNodes);
  });

  it("subscribes to onModelChange event and returns visible nodes", () => {
    const { result } = renderHook(
      (props: { modelSource: TreeModelSource }) => useVisibleTreeNodes(props.modelSource),
      { initialProps: { modelSource: modelSourceMock.object } },
    );

    expect(result.current).to.not.be.undefined;
    onModelChangeMock.verify((x) => x.addListener(moq.It.isAny()), moq.Times.once());
  });

  it("resubscribes to onModelChangeEvent when model source changes", () => {
    const { rerender } = renderHook(
      (props: { modelSource: TreeModelSource }) => useVisibleTreeNodes(props.modelSource),
      { initialProps: { modelSource: modelSourceMock.object } },
    );
    onModelChangeMock.verify((x) => x.addListener(moq.It.isAny()), moq.Times.once());

    const newOnModelChangeMock = moq.Mock.ofType<BeUiEvent<TreeModel>>();
    const newModelSourceMock = moq.Mock.ofType<TreeModelSource>();
    newModelSourceMock.setup((x) => x.onModelChanged).returns(() => newOnModelChangeMock.object);

    rerender({ modelSource: newModelSourceMock.object });

    onModelChangeMock.verify((x) => x.removeListener(moq.It.isAny()), moq.Times.once());
    newOnModelChangeMock.verify((x) => x.addListener(moq.It.isAny()), moq.Times.once());
  });

});

describe("useNodeLoader", () => {
  const dataProviderMock: TreeDataProviderRaw = [];

  it("creates NodeLoader", () => {
    const { result } = renderHook(
      (props: { dataProvider: TreeDataProvider }) => useNodeLoader(props.dataProvider),
      { initialProps: { dataProvider: dataProviderMock } },
    );

    expect(result.current).to.not.be.undefined;
  });

  it("creates new NodeLoader when data provider changes", () => {
    const { result, rerender } = renderHook(
      (props: { dataProvider: TreeDataProvider }) => useNodeLoader(props.dataProvider),
      { initialProps: { dataProvider: dataProviderMock } },
    );

    const firstNodeLoader = result.current;
    const newDataProviderMock: TreeDataProviderRaw = [];
    rerender({ dataProvider: newDataProviderMock });

    expect(result.current).to.not.be.deep.eq(firstNodeLoader);
  });

});

describe("usePagedNodeLoader", () => {
  const dataProviderMock: TreeDataProviderRaw = [];

  it("creates PagedNodeLoader", () => {
    const { result } = renderHook(
      (props: { dataProvider: TreeDataProvider, pageSize: number }) => usePagedNodeLoader(props.dataProvider, props.pageSize),
      { initialProps: { dataProvider: dataProviderMock, pageSize: 10 } },
    );

    expect(result.current).to.not.be.undefined;
  });

  it("creates new PagedNodeLoader when data provider changes", () => {
    const { result, rerender } = renderHook(
      (props: { dataProvider: TreeDataProvider, pageSize: number }) => usePagedNodeLoader(props.dataProvider, props.pageSize),
      { initialProps: { dataProvider: dataProviderMock, pageSize: 10 } },
    );

    const firstNodeLoader = result.current;
    const newDataProviderMock: TreeDataProviderRaw = [];
    rerender({ dataProvider: newDataProviderMock, pageSize: 10 });

    expect(result.current).to.not.be.deep.eq(firstNodeLoader);
  });

  it("creates new PagedNodeLoader when page size changes", () => {
    const { result, rerender } = renderHook(
      (props: { dataProvider: TreeDataProvider, pageSize: number }) => usePagedNodeLoader(props.dataProvider, props.pageSize),
      { initialProps: { dataProvider: dataProviderMock, pageSize: 10 } },
    );

    const firstNodeLoader = result.current;
    rerender({ dataProvider: dataProviderMock, pageSize: 20 });

    expect(result.current).to.not.be.deep.eq(firstNodeLoader!);
  });

});

describe("useModelSource", () => {
  const nodeLoaderMock = moq.Mock.ofType<ITreeNodeLoader>();
  let onNodeLoadedEvent: BeUiEvent<LoadedNodeHierarchy>;

  beforeEach(() => {
    nodeLoaderMock.reset();

    onNodeLoadedEvent = new BeUiEvent<LoadedNodeHierarchy>();
    nodeLoaderMock.setup((x) => x.onNodeLoaded).returns(() => onNodeLoadedEvent);
  });

  it("creates model source and subscribes to onNodeLoaded event", () => {
    const spy = sinon.spy(onNodeLoadedEvent, "addListener");
    const { result } = renderHook(
      (props: { nodeLoader: ITreeNodeLoader }) => useModelSource(props.nodeLoader),
      { initialProps: { nodeLoader: nodeLoaderMock.object } },
    );

    expect(spy).to.be.called;
    expect(result.current).to.not.be.undefined;
  });

  it("returns undefined if node loader is undefined", () => {
    const { result } = renderHook(
      (props: { nodeLoader: ITreeNodeLoader | undefined }) => useModelSource(props.nodeLoader),
      { initialProps: { nodeLoader: undefined } },
    );

    expect(result.current).to.be.undefined;
  });

  it("creates new model source and subscribes to onNodeLoaded event when node loader changes", () => {
    const removeListenerSpy = sinon.spy(onNodeLoadedEvent, "removeListener");
    const { result, rerender } = renderHook(
      (props: { nodeLoader: ITreeNodeLoader }) => useModelSource(props.nodeLoader),
      { initialProps: { nodeLoader: nodeLoaderMock.object } },
    );
    const firstModelSource = result.current;

    const newNodeLoader = moq.Mock.ofType<ITreeNodeLoader>();
    const nodeLoadedEvent = new BeUiEvent<LoadedNodeHierarchy>();
    newNodeLoader.setup((x) => x.onNodeLoaded).returns(() => nodeLoadedEvent);
    const addListenerSpy = sinon.spy(nodeLoadedEvent, "addListener");
    rerender({ nodeLoader: newNodeLoader.object });

    expect(removeListenerSpy).to.be.called;
    expect(addListenerSpy).to.be.called;
    expect(result.current).to.not.be.undefined;
    expect(firstModelSource).to.not.be.undefined;
    expect(result.current).to.not.eq(firstModelSource);
  });

});
