/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* tslint:disable:no-direct-imports */

import * as React from "react";
import { mount } from "enzyme";
import * as moq from "typemoq";
import {
  ControlledTree, TreeModelSource, TreeEvents, SelectionMode, TreeModel,
  VisibleTreeNodes, MutableTreeModel, ITreeNodeLoaderWithProvider,
} from "@bentley/ui-components";
import { BeUiEvent } from "@bentley/bentleyjs-core";
import { IPresentationTreeDataProvider } from "../../../tree/IPresentationTreeDataProvider";
import { controlledTreeWithModelSource } from "../../../tree/controlled/WithModelSource";

// tslint:disable-next-line:variable-name naming-convention
const PresentationTree = controlledTreeWithModelSource(ControlledTree);

describe("Tree withModelSource", () => {
  const modelSourceMock = moq.Mock.ofType<TreeModelSource>();
  const treeEventMock = moq.Mock.ofType<TreeEvents>();
  const nodeLoaderMock = moq.Mock.ofType<ITreeNodeLoaderWithProvider<IPresentationTreeDataProvider>>();
  const visibleNodes: VisibleTreeNodes = {
    getAtIndex: () => undefined,
    getNumNodes: () => 0,
    getNumRootNodes: () => 0,
    getModel: () => new MutableTreeModel(),
    [Symbol.iterator]: () => [][Symbol.iterator](),
  };

  modelSourceMock.setup((x) => x.onModelChanged).returns(() => new BeUiEvent<TreeModel>());
  modelSourceMock.setup((x) => x.getVisibleNodes()).returns(() => visibleNodes);

  it("mounts", () => {
    mount(<PresentationTree
      modelSource={modelSourceMock.object}
      nodeLoader={nodeLoaderMock.object}
      treeEvents={treeEventMock.object}
      selectionMode={SelectionMode.Single}
    />);

    // should be called 2 times: first time to initialize state in custom hook,
    // second time in useEffect
    modelSourceMock.verify((x) => x.getVisibleNodes(), moq.Times.exactly(2));
  });

});
