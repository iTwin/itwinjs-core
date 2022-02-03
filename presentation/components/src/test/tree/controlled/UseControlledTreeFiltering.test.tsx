/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import sinon from "sinon";
import * as moq from "typemoq";
import type { IModelConnection } from "@itwin/core-frontend";
import type { NodePathElement } from "@itwin/presentation-common";
import { ResolvablePromise } from "@itwin/presentation-common/lib/cjs/test";
import type { AbstractTreeNodeLoaderWithProvider, TreeModelNode, TreeModelSource } from "@itwin/components-react";
import { renderHook } from "@testing-library/react-hooks";
import type {
  ControlledPresentationTreeFilteringProps, IPresentationTreeDataProvider} from "../../../presentation-components";
import { useControlledPresentationTreeFiltering,
} from "../../../presentation-components";
import { FilteredPresentationTreeDataProvider } from "../../../presentation-components/tree/FilteredDataProvider";
import { createRandomPropertyRecord, createRandomTreeNodeItem } from "../../_helpers/UiComponents";

describe("useControlledPresentationTreeFiltering", () => {
  const nodeLoaderMock = moq.Mock.ofType<AbstractTreeNodeLoaderWithProvider<IPresentationTreeDataProvider>>();
  const modelSourceMock = moq.Mock.ofType<TreeModelSource>();
  const dataProviderMock = moq.Mock.ofType<IPresentationTreeDataProvider>();
  const imodelMock = moq.Mock.ofType<IModelConnection>();

  beforeEach(() => {
    imodelMock.reset();

    nodeLoaderMock.reset();
    nodeLoaderMock.setup((x) => x.dataProvider).returns(() => dataProviderMock.object);
    nodeLoaderMock.setup((x) => x.modelSource).returns(() => modelSourceMock.object);

    dataProviderMock.reset();
    dataProviderMock.setup((x) => x.imodel).returns(() => imodelMock.object);
    dataProviderMock.setup((x) => x.rulesetId).returns(() => "rulesetId");
  });

  it("does not start filtering if filter is not provided", () => {
    const { result } = renderHook(
      useControlledPresentationTreeFiltering,
      { initialProps: { nodeLoader: nodeLoaderMock.object } },
    );
    expect(result.current).to.not.be.undefined;
    expect(result.current.isFiltering).to.be.false;
  });

  it("starts filtering if filter is provided", async () => {
    const pathsResult1 = new ResolvablePromise<NodePathElement[]>();
    dataProviderMock.setup(async (x) => x.getFilteredNodePaths("test")).returns(async () => pathsResult1);

    const { result } = renderHook(
      useControlledPresentationTreeFiltering,
      { initialProps: { nodeLoader: nodeLoaderMock.object, filter: "test", activeMatchIndex: 0 } },
    );
    expect(result.current).to.not.be.undefined;
    expect(result.current.isFiltering).to.be.true;

    await pathsResult1.resolve([]);

    expect(result.current).to.not.be.undefined;
    expect(result.current.isFiltering).to.be.false;
    expect(result.current.filteredNodeLoader).to.not.eq(nodeLoaderMock.object);
  });

  it("does not start new filtering request while previous is still in progress", async () => {
    const clock = sinon.useFakeTimers();
    const pathsResult1 = new ResolvablePromise<NodePathElement[]>();
    const pathsResult2 = new ResolvablePromise<NodePathElement[]>();
    dataProviderMock.setup(async (x) => x.getFilteredNodePaths("test")).returns(async () => pathsResult1);
    dataProviderMock.setup(async (x) => x.getFilteredNodePaths("last")).returns(async () => pathsResult2);

    const initialProps: ControlledPresentationTreeFilteringProps = {
      nodeLoader: nodeLoaderMock.object,
      filter: "test",
    };
    const { result, rerender } = renderHook(
      useControlledPresentationTreeFiltering,
      { initialProps },
    );

    // give time to start request
    await clock.tickAsync(1);
    dataProviderMock.verify(async (x) => x.getFilteredNodePaths(moq.It.isAnyString()), moq.Times.once());
    expect(result.current).to.not.be.undefined;
    expect(result.current.isFiltering).to.be.true;

    // render with new filter and verify that new request was not started
    rerender({ ...initialProps, filter: "changed" });

    // give time to start request if necessary
    await clock.tickAsync(1);
    dataProviderMock.verify(async (x) => x.getFilteredNodePaths(moq.It.isAnyString()), moq.Times.once());
    expect(result.current).to.not.be.undefined;
    expect(result.current.isFiltering).to.be.true;

    // render with new filter again and verify that new request was not started
    rerender({ ...initialProps, filter: "last" });

    // give time to start request if necessary
    await clock.tickAsync(1);
    dataProviderMock.verify(async (x) => x.getFilteredNodePaths(moq.It.isAnyString()), moq.Times.once());
    expect(result.current).to.not.be.undefined;
    expect(result.current.isFiltering).to.be.true;

    clock.restore();
    // resolve first request and verify that new filtering request started
    await pathsResult1.resolve([]);
    dataProviderMock.verify(async (x) => x.getFilteredNodePaths(moq.It.isAnyString()), moq.Times.exactly(2));
    expect(result.current).to.not.be.undefined;
    expect(result.current.isFiltering).to.be.true;

    // resolve second request and verify state
    await pathsResult2.resolve([]);
    dataProviderMock.verify(async (x) => x.getFilteredNodePaths(moq.It.isAnyString()), moq.Times.exactly(2));
    dataProviderMock.verify(async (x) => x.getFilteredNodePaths("test"), moq.Times.once());
    dataProviderMock.verify(async (x) => x.getFilteredNodePaths("last"), moq.Times.once());
    expect(result.current).to.not.be.undefined;
    expect(result.current.isFiltering).to.be.false;
    expect(result.current.filteredNodeLoader).to.not.be.undefined;
    const filteredProvider = result.current.filteredNodeLoader.dataProvider;
    expect(filteredProvider).to.be.instanceOf(FilteredPresentationTreeDataProvider);
    expect((filteredProvider as FilteredPresentationTreeDataProvider).filter).to.be.eq("last");
  });

  it("clears filtering request still in progress", async () => {
    const clock = sinon.useFakeTimers();
    const pathsResult = new ResolvablePromise<NodePathElement[]>();
    dataProviderMock.setup(async (x) => x.getFilteredNodePaths("test")).returns(async () => pathsResult);

    const initialProps: ControlledPresentationTreeFilteringProps = {
      nodeLoader: nodeLoaderMock.object,
      filter: "test",
    };
    const { result, rerender } = renderHook(
      useControlledPresentationTreeFiltering,
      { initialProps },
    );

    // give time to start request if necessary
    await clock.tickAsync(1);
    dataProviderMock.verify(async (x) => x.getFilteredNodePaths(moq.It.isAnyString()), moq.Times.once());
    expect(result.current).to.not.be.undefined;
    expect(result.current.isFiltering).to.be.true;

    // render without filter
    rerender({ ...initialProps, filter: "" });

    // give time to start request if necessary
    await clock.tickAsync(1);
    dataProviderMock.verify(async (x) => x.getFilteredNodePaths(moq.It.isAnyString()), moq.Times.once());
    expect(result.current).to.not.be.undefined;
    expect(result.current.isFiltering).to.be.false;

    clock.restore();
    // resolve first request verify that filtering was not applied
    await pathsResult.resolve([]);
    dataProviderMock.verify(async (x) => x.getFilteredNodePaths(moq.It.isAnyString()), moq.Times.exactly(1));
    expect(result.current).to.not.be.undefined;
    expect(result.current.isFiltering).to.be.false;
    expect(result.current.filteredNodeLoader).to.be.deep.eq(nodeLoaderMock.object);
    expect(result.current.matchesCount).to.be.undefined;
  });

  it("filters when dataProvider changes", async () => {
    const pathsResult = new ResolvablePromise<NodePathElement[]>();
    const filter = "test";
    dataProviderMock.setup(async (x) => x.getFilteredNodePaths(filter)).returns(async () => pathsResult);

    const initialProps: ControlledPresentationTreeFilteringProps = {
      nodeLoader: nodeLoaderMock.object,
      filter,
    };
    const { result, rerender } = renderHook(
      useControlledPresentationTreeFiltering,
      { initialProps },
    );

    await pathsResult.resolve([]);
    expect(result.current).to.not.be.undefined;
    expect(result.current.isFiltering).to.be.false;
    expect(result.current.filteredNodeLoader).to.not.be.undefined;
    dataProviderMock.verify(async (x) => x.getFilteredNodePaths(filter), moq.Times.once());

    const newProvider = moq.Mock.ofType<IPresentationTreeDataProvider>();
    const newNodeLoader = moq.Mock.ofType<AbstractTreeNodeLoaderWithProvider<IPresentationTreeDataProvider>>();
    newNodeLoader.setup((x) => x.dataProvider).returns(() => newProvider.object);
    const newPathsResult = new ResolvablePromise<NodePathElement[]>();
    newProvider.setup(async (x) => x.getFilteredNodePaths(moq.It.isAnyString())).returns(async () => newPathsResult);

    rerender({ ...initialProps, nodeLoader: newNodeLoader.object });

    await newPathsResult.resolve([]);
    expect(result.current).to.not.be.undefined;
    expect(result.current.isFiltering).to.be.false;
    expect(result.current.filteredNodeLoader).to.not.be.undefined;
    newProvider.verify(async (x) => x.getFilteredNodePaths(filter), moq.Times.once());
  });

  it("filters node loader with FilteredPresentationTreeDataProvider", async () => {
    const pathsResult = new ResolvablePromise<NodePathElement[]>();
    dataProviderMock.setup(async (x) => x.getFilteredNodePaths(moq.It.isAny())).returns(async () => pathsResult);

    const initialProps: ControlledPresentationTreeFilteringProps = {
      nodeLoader: nodeLoaderMock.object,
      filter: "test",
    };
    const { result, rerender } = renderHook(
      useControlledPresentationTreeFiltering,
      { initialProps },
    );

    await pathsResult.resolve([]);
    expect(result.current).to.not.be.undefined;
    expect(result.current.isFiltering).to.be.false;

    const filteredNodeLoader = result.current.filteredNodeLoader;
    expect(filteredNodeLoader.dataProvider).to.be.instanceOf(FilteredPresentationTreeDataProvider);
    rerender({ ...initialProps, filter: "changed", nodeLoader: filteredNodeLoader });

    await pathsResult.resolve([]);
    expect(result.current).to.not.be.undefined;
    expect(result.current.isFiltering).to.be.false;
    expect(result.current.filteredNodeLoader).to.not.eq(filteredNodeLoader);

    // make sure that FilteredPresentationTreeDataProvider was not wrapped into another FilteredPresentationTreeDataProvider
    const provider = result.current.filteredNodeLoader.dataProvider;
    expect(provider).to.be.instanceOf(FilteredPresentationTreeDataProvider);
    expect((provider as FilteredPresentationTreeDataProvider).parentDataProvider).to.not.be.instanceOf(FilteredPresentationTreeDataProvider);
  });

  it("returns `filteredNodeLoader` with model whose root node's `numRootNodes` is undefined and `loadNode` method returns result with an empty `loadedNodes` array when filtering", (done) => {
    const testModelNode: TreeModelNode = {
      id: "test",
      checkbox: {
        isDisabled: false,
        isVisible: true,
        state: 0,
      },
      depth: 0,
      description: "",
      isExpanded: false,
      isSelected: false,
      item: createRandomTreeNodeItem(),
      label: createRandomPropertyRecord(),
      numChildren: 3,
      parentId: "parentId",
    };
    const initialProps: ControlledPresentationTreeFilteringProps = {
      nodeLoader: nodeLoaderMock.object,
      filter: "test",
    };
    const { result } = renderHook(
      useControlledPresentationTreeFiltering,
      { initialProps },
    );

    const nodeLoader = result.current.filteredNodeLoader;
    expect(result.current.isFiltering).to.be.true;
    expect(nodeLoader.modelSource.getModel().getRootNode().numChildren).to.be.undefined;
    nodeLoader.loadNode(testModelNode, 0).subscribe((res) => {
      expect(res).to.deep.eq({
        loadedNodes: [],
      });
      done();
    });
  });
});
