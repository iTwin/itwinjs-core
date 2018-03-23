/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ClassId, InstanceId } from "./EC";
import { Id64 } from "@bentley/bentleyjs-core";

 /** Base class for a @ref INavNode key which identifies similar nodes. */
export interface NavNodeKey {
  type: string;
  pathFromRoot: string[];
}
export interface ECInstanceNodeKey extends NavNodeKey {
  classId: ClassId;
  instanceId: InstanceId;
}

/** Contains a series of INavNodeKey objects which defines a path of nodes. */
export type NavNodeKeyPath = NavNodeKey[];

/** An abstract navigation node object. @ref INavNode objects are used to create a hierarchy
 * for presentation-driven trees.
 */
export interface NavNode {
  nodeId: Id64;
  parentNodeId?: Id64;
  key: NavNodeKey;
  label: string;
  description?: string;
  imageId?: string;
  foreColor?: string;
  backColor?: string;
  fontStyle?: string;
  hasChildren: boolean;
  isSelectable: boolean;
  isEditable: boolean;
  isChecked: boolean;
  isExpanded: boolean;
  isCheckboxVisible: boolean;
  isCheckboxEnabled: boolean;
}

/** An interface for a class that describes a single step in the nodes path. */
export interface NavNodePathElement {
  node: NavNode;
  index: number;
  isMarked: boolean;
  children: NavNodePathElement[];
}
