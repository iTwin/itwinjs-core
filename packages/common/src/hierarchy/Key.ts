/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { InstanceKey, InstanceKeyJSON, instanceKeyFromJSON } from "../EC";

export enum DefaultNodeTypes {
  ECInstanceNode = "ECInstanceNode",
  ECClassGroupingNode = "ECClassGroupingNode",
  ECPropertyGroupingNode = "ECPropertyGroupingNode",
  DisplayLabelGroupingNode = "DisplayLabelGroupingNode",
}

export type NodeKey = BaseNodeKey | ECInstanceNodeKey | ECClassGroupingNodeKey | ECPropertyGroupingNodeKey | LabelGroupingNodeKey;
export type NodeKeyPath = NodeKey[];

export interface BaseNodeKey {
  type: string;
  pathFromRoot: string[];
}

export interface ECInstanceNodeKey extends BaseNodeKey {
  type: DefaultNodeTypes.ECInstanceNode;
  instanceKey: InstanceKey;
}

export interface ECInstanceNodeKeyJSON extends BaseNodeKey {
  type: DefaultNodeTypes.ECInstanceNode;
  instanceKey: InstanceKeyJSON;
}

export interface ECClassGroupingNodeKey extends BaseNodeKey {
  type: DefaultNodeTypes.ECClassGroupingNode;
  className: string;
}

export interface ECPropertyGroupingNodeKey extends BaseNodeKey {
  type: DefaultNodeTypes.ECPropertyGroupingNode;
  className: string;
  propertyName: string;
  groupingValue: any;
}

export interface LabelGroupingNodeKey extends BaseNodeKey {
  type: DefaultNodeTypes.DisplayLabelGroupingNode;
  label: string;
}

export type NodeKeyJSON = BaseNodeKey | ECInstanceNodeKeyJSON | ECClassGroupingNodeKey | ECPropertyGroupingNodeKey | LabelGroupingNodeKey;
export const fromJSON = (json: NodeKeyJSON): NodeKey => {
  switch (json.type) {
    case DefaultNodeTypes.ECInstanceNode:
      return { ...json, instanceKey: instanceKeyFromJSON((json as ECInstanceNodeKeyJSON).instanceKey) };
    default:
      return { ...json };
  }
};
