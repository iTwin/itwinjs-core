/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import OldTree from "./OldTree";
import { ControlledTreeWithHooks } from "./ControlledTreeWithHooks";
import ControlledTreeWithHOCs from "./ControlledTreeWithHOCs";
import { TreeType } from "../tree-selector/TreeSelector";

interface Props {
  treeType: TreeType;
  imodel: IModelConnection;
  rulesetId: string;
}

// tslint:disable-next-line: variable-name
export const TreeWidget: React.FC<Props> = (props: Props) => {
  const renderTree = (treeType: TreeType) => {
    switch (treeType) {
      case TreeType.OldTree:
        return <OldTree imodel={props.imodel} rulesetId={props.rulesetId} />;
      case TreeType.ControlledWithHooks:
        return <ControlledTreeWithHooks imodel={props.imodel} rulesetId={props.rulesetId} />;
      case TreeType.ControlledWithHOC:
        return <ControlledTreeWithHOCs imodel={props.imodel} rulesetId={props.rulesetId} />;
    }
  };

  return renderTree(props.treeType);
};
