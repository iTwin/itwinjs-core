/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { ControlledTree, useVisibleTreeNodes, SelectionMode } from "@bentley/ui-components";
import { usePresentationTreeNodeLoader, useUnifiedSelectionTreeEventHandler } from "@bentley/presentation-components";

/** React properties for the tree component, that accepts an iModel connection with ruleset id */
export interface Props {
  /** iModel whose contents should be displayed in the tree */
  imodel: IModelConnection;
  /** ID of the presentation rule set to use for creating the hierarchy in the tree */
  rulesetId: string;
}

export default function SimpleTreeComponent(props: Props) {
  const nodeLoader = usePresentationTreeNodeLoader({ imodel: props.imodel, ruleset: props.rulesetId, pageSize: 20 });
  const visibleNodes = useVisibleTreeNodes(nodeLoader.modelSource);
  const eventsHandler = useUnifiedSelectionTreeEventHandler({ nodeLoader });
  return (
    <>
      <h3 data-testid="tree-component-header">{IModelApp.i18n.translate("SimpleEditor:components.tree")}</h3>
      <div style={{ flex: "1" }}>
        <ControlledTree nodeLoader={nodeLoader} visibleNodes={visibleNodes} treeEvents={eventsHandler} selectionMode={SelectionMode.Extended} />
      </div>
    </>
  );
}
