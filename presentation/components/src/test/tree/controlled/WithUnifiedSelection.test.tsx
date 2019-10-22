/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/* tslint:disable:no-direct-imports */

import * as React from "react";
import { mount } from "enzyme";
import * as moq from "@bentley/presentation-common/lib/test/_helpers/Mocks";
import { ControlledTree, TreeModelSource, TreeEvents, SelectionMode, TreeModel, UiComponents, VisibleTreeNodes, MutableTreeModel } from "@bentley/ui-components";
import { controlledTreeWithUnifiedSelection } from "../../../tree/controlled/WithUnifiedSelection";
import { BeUiEvent } from "@bentley/bentleyjs-core";
import { SelectionChangeEvent, SelectionManager, Presentation } from "@bentley/presentation-frontend";
import { IPresentationTreeDataProvider } from "../../../presentation-components";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { I18N } from "@bentley/imodeljs-i18n";

// tslint:disable-next-line:variable-name naming-convention
const PresentationTree = controlledTreeWithUnifiedSelection(ControlledTree);

describe("Tree withUnifiedSelection", () => {
  before(async () => {
    await UiComponents.initialize(new I18N());
  });

  const modelSourceMock = moq.Mock.ofType<TreeModelSource<IPresentationTreeDataProvider>>();
  const treeEventMock = moq.Mock.ofType<TreeEvents>();
  const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
  const dataProviderMock = moq.Mock.ofType<IPresentationTreeDataProvider>();
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
  modelSourceMock.setup((x) => x.getDataProvider()).returns(() => dataProviderMock.object);
  dataProviderMock.setup((x) => x.imodel).returns(() => imodelMock.object);
  dataProviderMock.setup((x) => x.rulesetId).returns(() => "TestRuleset");

  it("mounts", () => {
    mount(<PresentationTree
      modelSource={modelSourceMock.object}
      nodeLoader={modelSourceMock.object}
      treeEvents={treeEventMock.object}
      selectionMode={SelectionMode.Single}
    />);
  });

});
