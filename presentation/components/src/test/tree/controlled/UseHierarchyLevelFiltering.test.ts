/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { from } from "rxjs/internal/observable/from";
import * as moq from "typemoq";
import { PropertyRecord } from "@itwin/appui-abstract";
import { ITreeNodeLoader, PropertyFilterRuleOperator, TreeModelNodeInput, TreeModelSource, UiComponents } from "@itwin/components-react";
import { EmptyLocalization } from "@itwin/core-common";
import { createRandomECInstancesNodeKey, createTestPropertiesContentField, createTestPropertyInfo } from "@itwin/presentation-common/lib/cjs/test";
import { renderHook } from "@testing-library/react-hooks";
import { PresentationInstanceFilterInfo } from "../../../presentation-components/instance-filter-builder/PresentationInstanceFilterBuilder";
import { useHierarchyLevelFiltering } from "../../../presentation-components/tree/controlled/UseHierarchyLevelFiltering";
import { PresentationTreeNodeItem } from "../../../presentation-components/tree/DataProvider";

function createTreeModelInput(input?: Partial<TreeModelNodeInput>, treeItem?: Partial<PresentationTreeNodeItem>): TreeModelNodeInput {
  const item: PresentationTreeNodeItem = {
    ...treeItem,
    id: treeItem?.id ?? input?.id ?? "node_id",
    key: treeItem?.key ?? createRandomECInstancesNodeKey(),
    label: treeItem?.label ?? input?.label ?? PropertyRecord.fromString("Node Label"),
  };
  return {
    ...input,
    id: item.id,
    isExpanded: input?.isExpanded ?? false,
    isLoading: input?.isLoading ?? false,
    isSelected: input?.isSelected ?? false,
    label: item.label,
    item,
  };
}

describe("useHierarchyLevelFiltering", () => {
  const nodeLoaderMock = moq.Mock.ofType<ITreeNodeLoader>();
  const modelSource = new TreeModelSource();
  const property = createTestPropertyInfo();
  const field = createTestPropertiesContentField({ properties: [{ property }] });
  const filterInfo: PresentationInstanceFilterInfo = {
    filter: {
      field,
      operator: PropertyFilterRuleOperator.IsNull,
    },
    usedClasses: [],
  };

  before(async () => {
    await UiComponents.initialize(new EmptyLocalization());
  });

  after(() => {
    UiComponents.terminate();
  });

  beforeEach(() => {
    nodeLoaderMock.reset();
    modelSource.modifyModel((model) => { model.clearChildren(undefined); });
  });

  it("applies filter", () => {
    const node = createTreeModelInput();
    modelSource.modifyModel((model) => { model.setChildren(undefined, [node], 0); });

    const { result } = renderHook(useHierarchyLevelFiltering,
      { initialProps: { modelSource, nodeLoader: nodeLoaderMock.object } }
    );

    result.current.applyFilter(node.item, filterInfo);
    const treeModel = modelSource.getModel();
    expect((treeModel.getNode(node.id)?.item as PresentationTreeNodeItem).filterInfo).to.be.eq(filterInfo);
  });

  it("reloads children after filter applied to expanded node", () => {
    const node = createTreeModelInput({ isExpanded: true });
    modelSource.modifyModel((model) => { model.setChildren(undefined, [node], 0); });

    nodeLoaderMock
      .setup((x) => x.loadNode(moq.It.is((parentNode) => parentNode?.id === node.id), 0))
      .returns(() => from([]))
      .verifiable(moq.Times.once());

    const { result } = renderHook(useHierarchyLevelFiltering,
      { initialProps: { modelSource, nodeLoader: nodeLoaderMock.object } }
    );

    result.current.applyFilter(node.item, filterInfo);
    nodeLoaderMock.verifyAll();
  });

  it("clears children when filter applied", () => {
    const parentNode = createTreeModelInput({ id: "parent_id" });
    const childNode = createTreeModelInput({ id: "child_id" });
    modelSource.modifyModel((model) => {
      model.setChildren(undefined, [parentNode], 0);
      model.setChildren(parentNode.id, [childNode], 0);
    });

    expect(modelSource.getModel().getNode(childNode.id)).to.not.be.undefined;

    const { result } = renderHook(useHierarchyLevelFiltering,
      { initialProps: { modelSource, nodeLoader: nodeLoaderMock.object } }
    );

    result.current.applyFilter(parentNode.item, filterInfo);
    expect(modelSource.getModel().getNode(childNode.id)).to.be.undefined;
  });

  it("does not apply filter on non presentation tree node item", () => {
    const parentNode: TreeModelNodeInput = { ...createTreeModelInput({ id: "parent_id" }), item: { id: "parent_id", label: PropertyRecord.fromString("Node Label") } };
    const childNode: TreeModelNodeInput = { ...createTreeModelInput({ id: "child_id" }), item: { id: "child_id", label: PropertyRecord.fromString("Node Label") } };
    modelSource.modifyModel((model) => {
      model.setChildren(undefined, [parentNode], 0);
      model.setChildren(parentNode.id, [childNode], 0);
    });

    const { result } = renderHook(useHierarchyLevelFiltering,
      { initialProps: { modelSource, nodeLoader: nodeLoaderMock.object } }
    );

    result.current.applyFilter(parentNode.item, filterInfo);
    expect(modelSource.getModel().getNode(childNode.id)).to.not.be.undefined;
  });

  it("clears filter", () => {
    const node = createTreeModelInput(undefined, { filterInfo });
    modelSource.modifyModel((model) => {
      model.setChildren(undefined, [node], 0);
    });

    expect((modelSource.getModel().getNode(node.id)?.item as PresentationTreeNodeItem).filterInfo).to.not.be.undefined;

    const { result } = renderHook(useHierarchyLevelFiltering,
      { initialProps: { modelSource, nodeLoader: nodeLoaderMock.object } }
    );

    result.current.clearFilter(node.item);
    expect((modelSource.getModel().getNode(node.id)?.item as PresentationTreeNodeItem).filterInfo).to.be.undefined;
  });

  it("reloads children after filter cleared on expanded node", () => {
    const node = createTreeModelInput({ isExpanded: true }, { filterInfo });
    modelSource.modifyModel((model) => { model.setChildren(undefined, [node], 0); });

    nodeLoaderMock
      .setup((x) => x.loadNode(moq.It.is((parentNode) => parentNode?.id === node.id), 0))
      .returns(() => from([]))
      .verifiable(moq.Times.once());

    const { result } = renderHook(useHierarchyLevelFiltering,
      { initialProps: { modelSource, nodeLoader: nodeLoaderMock.object } }
    );

    result.current.clearFilter(node.item);
    nodeLoaderMock.verifyAll();
  });

  it("clears children when filter cleared", () => {
    const parentNode = createTreeModelInput({ id: "parent_id" }, { filterInfo });
    const childNode = createTreeModelInput({ id: "child_id" });
    modelSource.modifyModel((model) => {
      model.setChildren(undefined, [parentNode], 0);
      model.setChildren(parentNode.id, [childNode], 0);
    });

    expect(modelSource.getModel().getNode(childNode.id)).to.not.be.undefined;

    const { result } = renderHook(useHierarchyLevelFiltering,
      { initialProps: { modelSource, nodeLoader: nodeLoaderMock.object } }
    );

    result.current.clearFilter(parentNode.item);
    expect(modelSource.getModel().getNode(childNode.id)).to.be.undefined;
  });
});
