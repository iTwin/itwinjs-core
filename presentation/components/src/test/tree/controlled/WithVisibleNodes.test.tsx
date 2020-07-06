/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* tslint:disable:no-direct-imports */

import { mount } from "enzyme";
import * as React from "react";
import * as moq from "typemoq";
import { BeUiEvent } from "@bentley/bentleyjs-core";
import {
  AbstractTreeNodeLoaderWithProvider, ControlledTree, MutableTreeModel, SelectionMode, TreeEvents, TreeModel, TreeModelChanges, TreeModelSource,
  VisibleTreeNodes,
} from "@bentley/ui-components";
import {
  DEPRECATED_controlledTreeWithVisibleNodes as controlledTreeWithVisibleNodes,
} from "../../../presentation-components/tree/controlled/WithVisibleNodes";
import { IPresentationTreeDataProvider } from "../../../presentation-components/tree/IPresentationTreeDataProvider";

// tslint:disable:deprecation

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
