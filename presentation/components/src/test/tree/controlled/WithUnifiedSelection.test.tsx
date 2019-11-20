/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/* tslint:disable:no-direct-imports */

import * as React from "react";
import { mount } from "enzyme";
import * as moq from "typemoq";
import {
  ControlledTree, TreeModelSource, TreeEvents, SelectionMode, TreeModel,
  UiComponents, VisibleTreeNodes, MutableTreeModel, ITreeNodeLoaderWithProvider
} from "@bentley/ui-components";
import { BeUiEvent } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { I18N } from "@bentley/imodeljs-i18n";
import { SelectionChangeEvent, SelectionManager, Presentation } from "@bentley/presentation-frontend";
import { controlledTreeWithUnifiedSelection } from "../../../tree/controlled/WithUnifiedSelection";
import { IPresentationTreeDataProvider } from "../../../tree/IPresentationTreeDataProvider";
import { controlledTreeWithModelSource } from "../../../tree/controlled/WithModelSource";

// tslint:disable-next-line:variable-name naming-convention
const PresentationTree = controlledTreeWithUnifiedSelection(controlledTreeWithModelSource(ControlledTree));

describe("Tree withUnifiedSelection", () => {
  before(async () => {
    await UiComponents.initialize(new I18N());
  });

  const modelSourceMock = moq.Mock.ofType<TreeModelSource>();
  const treeEventMock = moq.Mock.ofType<TreeEvents>();
  const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
  const dataProviderMock = moq.Mock.ofType<IPresentationTreeDataProvider>();
  const nodeLoaderMock = moq.Mock.ofType<ITreeNodeLoaderWithProvider<IPresentationTreeDataProvider>>();
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const visibleNodes: VisibleTreeNodes = {
    getAtIndex: () => undefined,
    getNumNodes: () => 0,
    getNumRootNodes: () => 0,
    getModel: () => new MutableTreeModel(),
    [Symbol.iterator]: () => [][Symbol.iterator](),
  };

  modelSourceMock.setup((x) => x.onModelChanged).returns(() => new BeUiEvent<TreeModel>());
  selectionManagerMock.setup((x) => x.selectionChange).returns(() => new SelectionChangeEvent());
  Presentation.selection = selectionManagerMock.object;
  modelSourceMock.setup((x) => x.getVisibleNodes()).returns(() => visibleNodes);
  nodeLoaderMock.setup((x) => x.getDataProvider()).returns(() => dataProviderMock.object);
  dataProviderMock.setup((x) => x.imodel).returns(() => imodelMock.object);
  dataProviderMock.setup((x) => x.rulesetId).returns(() => "TestRuleset");

  it("mounts", () => {
    mount(<PresentationTree
      modelSource={modelSourceMock.object}
      nodeLoader={nodeLoaderMock.object}
      treeEvents={treeEventMock.object}
      selectionMode={SelectionMode.Single}
    />);
  });

});
