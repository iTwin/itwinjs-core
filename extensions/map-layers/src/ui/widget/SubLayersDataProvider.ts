/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BeEvent, compareStringsOrUndefined } from "@bentley/bentleyjs-core";
import { MapSubLayerProps, SubLayerId } from "@bentley/imodeljs-common";
import { PropertyRecord } from "@bentley/ui-abstract";
import { DelayLoadedTreeNodeItem, ITreeDataProvider, TreeDataChangesListener, TreeNodeItem } from "@bentley/ui-components";
import { CheckBoxState } from "@bentley/ui-core";
import { StyleMapLayerSettings } from "./MapLayerManager";

/**
 * Data provider that returns some fake nodes to show in tree.
 */
export class SubLayersDataProvider implements ITreeDataProvider {
  private readonly _nodeMap = new Map<string, TreeNodeItem[]>();

  private createId(props: MapSubLayerProps): string {
    return undefined !== props.id ? `${props.id}` : props.name ? props.name : "no-id";
  }

  private createNode(props: MapSubLayerProps): DelayLoadedTreeNodeItem {
    return {
      id: this.createId(props),
      label: PropertyRecord.fromString(props.title ?? props.name ?? "unknown"),
      hasChildren: !!props.children,
      isCheckboxVisible: true,
      checkBoxState: props.visible ? CheckBoxState.On : CheckBoxState.Off,
      extendedData: { subLayerId: props.id },
    };
  }

  private loadChildNodes(allSubLayers: MapSubLayerProps[], parentId?: SubLayerId) {
    const filteredProps = allSubLayers.filter((props) => parentId === props.parent);
    if (filteredProps.length) {
      filteredProps?.sort((a: MapSubLayerProps, b: MapSubLayerProps) => compareStringsOrUndefined(a.title, b.title));
      const treeNodes: TreeNodeItem[] = [];

      filteredProps.forEach((props) => {
        treeNodes.push(this.createNode(props));
        if (props.children)
          this.loadChildNodes(allSubLayers, props.id);
      });

      this._nodeMap.set(undefined !== parentId ? `${parentId}` : "", treeNodes);
    }
  }

  private loadNodes(subLayerNodes: MapSubLayerProps[] | undefined) {
    subLayerNodes?.sort((a: MapSubLayerProps, b: MapSubLayerProps) => compareStringsOrUndefined(a.title, b.title));
    if (subLayerNodes) {
      this.loadChildNodes(subLayerNodes, undefined);
    }
  }

  constructor(mapLayer: StyleMapLayerSettings) {
    this.loadNodes(mapLayer.subLayers);
  }

  public onTreeNodeChanged = new BeEvent<TreeDataChangesListener>();

  public async getNodesCount(parent?: TreeNodeItem) {
    const nodeArray: TreeNodeItem[] | undefined = parent ? this._nodeMap.get(parent.id) : this._nodeMap.get("");
    if (nodeArray)
      return nodeArray.length;

    return 0;
  }

  public async getNodes(parent?: TreeNodeItem) {
    const nodeArray: TreeNodeItem[] | undefined = parent ? this._nodeMap.get(parent.id) : this._nodeMap.get("");
    if (nodeArray)
      return nodeArray;

    return [];
  }
}
