/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelApp } from "@bentley/imodeljs-frontend";

import "./TreeSelector.css";

export enum TreeType {
  OldTree,
  ControlledWithHooks,
  ControlledWithHOC,
}

interface Props {
  onTreeTypeSelected: (treeType: TreeType) => void;
}

const availableTreeTypes = [TreeType.OldTree, TreeType.ControlledWithHooks, TreeType.ControlledWithHOC];

// tslint:disable-next-line: variable-name
export const TreeSelector: React.FC<Props> = (props: Props) => {
  const [selectedTree, setSelectedTree] = React.useState(TreeType.ControlledWithHooks);

  const treeName = (treeType: TreeType) => {
    switch (treeType) {
      case TreeType.OldTree:
        return "Old Tree";
      case TreeType.ControlledWithHooks:
        return "Controlled Tree With Hooks";
      case TreeType.ControlledWithHOC:
        return "Controlled Tree With HOCs";
    }
  };

  React.useEffect(() => {
    props.onTreeTypeSelected(selectedTree);
  }, [selectedTree]);

  return (
    <div className="TreeSelector">
      {IModelApp.i18n.translate("Sample:controls.notifications.select-tree-type")}:
      <select onChange={(e) => setSelectedTree(Number(e.target.value))} defaultValue={selectedTree}>
        {availableTreeTypes.map((treeType: TreeType) => (
          <option key={treeType} value={treeType}>{treeName(treeType)}</option>
        ))}
      </select>
    </div>
  );
};
