/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ClassId, InstanceId } from "./EC";

 /** Base class for a @ref INavNode key which identifies similar nodes. */
export interface NavNodeKey {
  type: string;
  pathFromRoot: string[];
  classId: ClassId;
}
export interface ECInstanceNodeKey extends NavNodeKey {
  instanceId: InstanceId;
}

/** Contains a series of INavNodeKey objects which defines a path of nodes. */
export type NavNodeKeyPath = NavNodeKey[];

/** An abstract navigation node object. @ref INavNode objects are used to create a hierarchy
 * for presentation-driven trees.
 */
export interface NavNode {
  nodeId: number;
  parentNodeId?: number;
  key: NavNodeKey;
  label: string;
  description: string;
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

/** A set of unique @ref NavNodeKey objects. */
export class NavNodeKeySet {
  private _size: number;
  private _dictionary: { [key: string]: NavNodeKey };

  /** Constructor. */
  constructor() {
    this._size = 0;
    this._dictionary = {};
  }

  private static toString(keyBase: NavNodeKey): string {
    /* todo:
    switch (keyBase.Type) {
      case NavNodeType.ECInstanceNode:
        {
          let key = <IECInstanceNodeKey>keyBase;
          return "eci_" + key.ECClassId + ":" + key.ECInstanceId;
        }
      default:
        {
          let key = <IGroupingNodeKey>keyBase;
          return key.NodeId;
        }
    }*/
    return keyBase.type;
  }

  /** Initializes this set from the supplied array of NavNodeKeys. */
  public initFromArray(keys: NavNodeKey[]): void {
    this.clear();
    for (const key of keys)
      this.add(key);
  }

  /** Initializes this set from another set of NavNodeKeys. */
  public initFromSet(keys: NavNodeKeySet): void {
    this.clear();
    for (const key in keys._dictionary) {
      if (keys._dictionary.hasOwnProperty(key))
        this.add(keys._dictionary[key]);
    }
  }

  /** Create an array from this set. */
  public asArray(): NavNodeKey[] {
    const arr = new Array<NavNodeKey>();
    for (const key in this._dictionary) {
      if (this._dictionary.hasOwnProperty(key))
        arr.push(this._dictionary[key]);
    }
    return arr;
  }

  /** Add a new key into this set. */
  public add(key: NavNodeKey): void {
    const strKey = NavNodeKeySet.toString(key);
    if (!this._dictionary.hasOwnProperty(strKey)) {
      this._dictionary[strKey] = key;
      ++this._size;
    }
  }

  /** Remove the key from this set. */
  public remove(key: NavNodeKey): void {
    const strKey = NavNodeKeySet.toString(key);
    if (this._dictionary.hasOwnProperty(strKey)) {
      delete this._dictionary[strKey];
      --this._size;
    }
  }

  /** Does this set contain the supplied key. */
  public contains(key: NavNodeKey): boolean {
    return this._dictionary.hasOwnProperty(NavNodeKeySet.toString(key));
  }

  /** Removed all keys from this set. */
  public clear(): void { this._dictionary = {}; this._size = 0; }

  /** Is this set empty. */
  public get isEmpty(): boolean { return 0 === this._size; }

  /** Get the size of this set. */
  public get size(): number { return this._size; }
}

/** An interface for a class that describes a single step in the nodes path. */
export interface NavNodePathElement {
  node: NavNode;
  index: number;
  isMarked: boolean;
  children: NavNodePathElement[];
}
