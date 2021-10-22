/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import sinon from "sinon";
import * as moq from "typemoq";
import { BeUiEvent } from "@itwin/core-bentley";
import { renderHook } from "@testing-library/react-hooks";
import { TreeEventHandler, TreeEventHandlerParams } from "../../../components-react/tree/controlled/TreeEventHandler";
import {
  usePagedTreeNodeLoader, useTreeEventsHandler, useTreeModel, useTreeModelSource, useTreeNodeLoader,
} from "../../../components-react/tree/controlled/TreeHooks";
import { MutableTreeModel, TreeModel } from "../../../components-react/tree/controlled/TreeModel";
import { TreeModelChanges, TreeModelSource } from "../../../components-react/tree/controlled/TreeModelSource";
import { ITreeNodeLoader } from "../../../components-react/tree/controlled/TreeNodeLoader";
import { TreeDataProvider, TreeDataProviderRaw } from "../../../components-react/tree/TreeDataProvider";

describe("useTreeModel", () => {
  const modelSourceMock = moq.Mock.ofType<TreeModelSource>();
  const testModel = new MutableTreeModel();
  let onModelChangeEvent: BeUiEvent<[TreeModel, TreeModelChanges]>;

  beforeEach(() => {
    modelSourceMock.reset();
    onModelChangeEvent = new BeUiEvent<[TreeModel, TreeModelChanges]>();

    modelSourceMock.setup((x) => x.onModelChanged).returns(() => onModelChangeEvent);
    modelSourceMock.setup((x) => x.getModel()).returns(() => testModel);
  });

  it("subscribes to onModelChange event and returns visible nodes", () => {
    const spy = sinon.spy(onModelChangeEvent, "addListener");
    const { result } = renderHook(
      (props: { modelSource: TreeModelSource }) => useTreeModel(props.modelSource),
      { initialProps: { modelSource: modelSourceMock.object } },
    );

    expect(result.current).to.not.be.undefined;
    expect(spy).to.have.been.calledOnce;
  });

  it("resubscribes to onModelChangeEvent when model source changes", () => {
    const firstModelEventAddSpy = sinon.spy(onModelChangeEvent, "addListener");
    const firstModelEventRemoveSpy = sinon.spy(onModelChangeEvent, "removeListener");
    const { rerender } = renderHook(
      (props: { modelSource: TreeModelSource }) => useTreeModel(props.modelSource),
      { initialProps: { modelSource: modelSourceMock.object } },
    );
    expect(firstModelEventAddSpy).to.have.been.calledOnce;

    const newOnModelChangeEvent = new BeUiEvent<[TreeModel, TreeModelChanges]>();
    const newModelEventAddSpy = sinon.spy(newOnModelChangeEvent, "addListener");
    const newModelSourceMock = moq.Mock.ofType<TreeModelSource>();
    newModelSourceMock.setup((x) => x.onModelChanged).returns(() => newOnModelChangeEvent);

    rerender({ modelSource: newModelSourceMock.object });

    expect(firstModelEventRemoveSpy).to.have.been.calledOnce;
    expect(newModelEventAddSpy).to.have.been.calledOnce;
  });

});

describe("useTreeNodeLoader", () => {
  const dataProviderMock: TreeDataProviderRaw = [];
  const modelSourceMock = moq.Mock.ofType<TreeModelSource>();

  it("creates NodeLoader", () => {
    const { result } = renderHook(
      (props: { dataProvider: TreeDataProvider, modelSource: TreeModelSource }) => useTreeNodeLoader(props.dataProvider, props.modelSource),
      { initialProps: { dataProvider: dataProviderMock, modelSource: modelSourceMock.object } },
    );

    expect(result.current).to.not.be.undefined;
  });

  it("returns same NodeLoader if data provider does not changes", () => {
    const { result, rerender } = renderHook(
      (props: { dataProvider: TreeDataProvider, modelSource: TreeModelSource }) => useTreeNodeLoader(props.dataProvider, props.modelSource),
      { initialProps: { dataProvider: dataProviderMock, modelSource: modelSourceMock.object } },
    );
    const nodeLoader = result.current;
    rerender();

    expect(result.current).to.be.eq(nodeLoader);
  });

  it("disposes NodeLoader on unmount", () => {
    const { result, unmount } = renderHook(
      (props: { dataProvider: TreeDataProvider, modelSource: TreeModelSource }) => useTreeNodeLoader(props.dataProvider, props.modelSource),
      { initialProps: { dataProvider: dataProviderMock, modelSource: modelSourceMock.object } },
    );
    const spy = sinon.spy(result.current, "dispose");
    unmount();

    expect(spy).to.be.called;
  });

  it("creates new NodeLoader when data provider changes", () => {
    const { result, rerender } = renderHook(
      (props: { dataProvider: TreeDataProvider, modelSource: TreeModelSource }) => useTreeNodeLoader(props.dataProvider, props.modelSource),
      { initialProps: { dataProvider: dataProviderMock, modelSource: modelSourceMock.object } },
    );

    const firstNodeLoader = result.current;
    const disposeSpy = sinon.spy(firstNodeLoader, "dispose");
    const newDataProviderMock: TreeDataProviderRaw = [];
    rerender({ dataProvider: newDataProviderMock, modelSource: modelSourceMock.object });

    expect(result.current).to.not.be.deep.eq(firstNodeLoader);
    expect(disposeSpy).to.be.called;
  });

});

describe("usePagedTreeNodeLoader", () => {
  const dataProviderMock: TreeDataProviderRaw = [];
  const modelSourceMock = moq.Mock.ofType<TreeModelSource>();

  it("creates PagedNodeLoader", () => {
    const { result } = renderHook(
      (props: { dataProvider: TreeDataProvider, modelSource: TreeModelSource, pageSize: number }) => usePagedTreeNodeLoader(props.dataProvider, props.pageSize, props.modelSource),
      { initialProps: { dataProvider: dataProviderMock, pageSize: 10, modelSource: modelSourceMock.object } },
    );

    expect(result.current).to.not.be.undefined;
  });

  it("returns same PagedNodeLoader if dependencies do not changes", () => {
    const { result, rerender } = renderHook(
      (props: { dataProvider: TreeDataProvider, modelSource: TreeModelSource, pageSize: number }) => usePagedTreeNodeLoader(props.dataProvider, props.pageSize, props.modelSource),
      { initialProps: { dataProvider: dataProviderMock, pageSize: 10, modelSource: modelSourceMock.object } },
    );
    const nodeLoader = result.current;
    rerender();

    expect(result.current).to.be.eq(nodeLoader);
  });

  it("disposes PagedNodeLoader on unmount", () => {
    const { result, unmount } = renderHook(
      (props: { dataProvider: TreeDataProvider, modelSource: TreeModelSource, pageSize: number }) => usePagedTreeNodeLoader(props.dataProvider, props.pageSize, props.modelSource),
      { initialProps: { dataProvider: dataProviderMock, pageSize: 10, modelSource: modelSourceMock.object } },
    );
    const spy = sinon.spy(result.current, "dispose");
    unmount();

    expect(spy).to.be.called;
  });

  it("creates new PagedNodeLoader when data provider changes", () => {
    const { result, rerender } = renderHook(
      (props: { dataProvider: TreeDataProvider, modelSource: TreeModelSource, pageSize: number }) => usePagedTreeNodeLoader(props.dataProvider, props.pageSize, props.modelSource),
      { initialProps: { dataProvider: dataProviderMock, pageSize: 10, modelSource: modelSourceMock.object } },
    );

    const firstNodeLoader = result.current;
    const disposeSpy = sinon.spy(firstNodeLoader, "dispose");
    const newDataProviderMock: TreeDataProviderRaw = [];
    rerender({ dataProvider: newDataProviderMock, pageSize: 10, modelSource: modelSourceMock.object });

    expect(result.current).to.not.be.deep.eq(firstNodeLoader);
    expect(disposeSpy).to.be.called;
  });

  it("creates new PagedNodeLoader when page size changes", () => {
    const { result, rerender } = renderHook(
      (props: { dataProvider: TreeDataProvider, modelSource: TreeModelSource, pageSize: number }) => usePagedTreeNodeLoader(props.dataProvider, props.pageSize, props.modelSource),
      { initialProps: { dataProvider: dataProviderMock, pageSize: 10, modelSource: modelSourceMock.object } },
    );

    const firstNodeLoader = result.current;
    rerender({ dataProvider: dataProviderMock, pageSize: 20, modelSource: modelSourceMock.object });

    expect(result.current).to.not.be.deep.eq(firstNodeLoader);
  });

});

describe("useTreeModelSource", () => {
  const dataProviderMock: TreeDataProviderRaw = [];

  it("creates model source", () => {
    const { result } = renderHook(
      (props: { dataProvider: TreeDataProvider }) => useTreeModelSource(props.dataProvider),
      { initialProps: { dataProvider: dataProviderMock } },
    );

    expect(result.current).to.not.be.undefined;
  });

});

describe("useTreeEventsHandler", () => {

  it("creates and disposes events handler using factory function", () => {
    const disposeSpy = sinon.spy();
    const handler = { dispose: disposeSpy };
    const factory = sinon.mock().returns(handler);
    const { result, unmount } = renderHook(
      (props: { factory: () => TreeEventHandler }) => useTreeEventsHandler(props.factory),
      { initialProps: { factory } },
    );
    expect(factory).to.be.calledOnce;
    expect(result.current).to.eq(handler);
    expect(disposeSpy).to.not.be.called;
    unmount();
    expect(disposeSpy).to.be.calledOnce;
  });

  it("creates and disposes events handler using event handler params", () => {
    const nodeLoaderMock = moq.Mock.ofType<ITreeNodeLoader>();
    const modelSourceMock = moq.Mock.ofType<TreeModelSource>();
    const { result, unmount } = renderHook(
      (props: { params: TreeEventHandlerParams }) => useTreeEventsHandler(props.params),
      { initialProps: { params: { nodeLoader: nodeLoaderMock.object, modelSource: modelSourceMock.object } } },
    );
    expect(result.current).to.not.be.undefined;
    const disposeSpy = sinon.spy(result.current, "dispose");
    expect(disposeSpy).to.not.be.called;
    unmount();
    expect(disposeSpy).to.be.calledOnce;
  });

});
