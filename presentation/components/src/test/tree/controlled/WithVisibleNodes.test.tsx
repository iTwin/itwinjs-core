/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* tslint:disable:no-direct-imports */

import * as React from "react";
import { mount } from "enzyme";
import * as moq from "typemoq";
import {
  ControlledTree, TreeModelSource, TreeEvents, SelectionMode, TreeModel, TreeModelChanges,
  VisibleTreeNodes, MutableTreeModel, AbstractTreeNodeLoaderWithProvider,
} from "@bentley/ui-components";
import { BeUiEvent } from "@bentley/bentleyjs-core";
import { IPresentationTreeDataProvider } from "../../../presentation-components/tree/IPresentationTreeDataProvider";
import { controlledTreeWithVisibleNodes } from "../../../presentation-components/tree/controlled/WithVisibleNodes";

// tslint:disable-next-line:variable-name naming-convention
const PresentationTree = controlledTreeWithVisibleNodes(ControlledTree);

describe("Tree withModelSource", () => {
  const modelSourceMock = moq.Mock.ofType<TreeModelSource>();
  const treeEventMock = moq.Mock.ofType<TreeEvents>();
  const treeNodeLoaderMock = moq.Mock.ofType<AbstractTreeNodeLoaderWithProvider<IPresentationTreeDataProvider>>();
  const visibleNodes: VisibleTreeNodes = {
    getAtIndex: () => undefined,
    getNumNodes: () => 0,
    getNumRootNodes: () => 0,
    getModel: () => new MutableTreeModel(),
    [Symbol.iterator]: () => [][Symbol.iterator](),
  };

  beforeEach(() => {
    modelSourceMock.setup((x) => x.onModelChanged).returns(() => new BeUiEvent<[TreeModel, TreeModelChanges]>());
    modelSourceMock.setup((x) => x.getVisibleNodes()).returns(() => visibleNodes);
    treeNodeLoaderMock.setup((x) => x.modelSource).returns(() => modelSourceMock.object);
  });

  it("mounts", () => {
    mount(<PresentationTree
      nodeLoader={treeNodeLoaderMock.object}
      treeEvents={treeEventMock.object}
      selectionMode={SelectionMode.Single}
    />);
  });

});
