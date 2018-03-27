/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { SelectedItem } from "./SelectedItem";

export class SelectedItemsSet {
  private _size: number;
  private _dictionary: { [key: string]: SelectedItem };

  /** Constructor. */
  constructor() {
    this._size = 0;
    this._dictionary = {};
  }

  private static toString(item: SelectedItem): string {
    //  // @todo:
    // switch (item.Type) {
    //   case NavNodeType.ECInstanceNode:
    //     {
    //       const key = <IECInstanceNodeKey>keyBase;
    //       return "eci_" + key.ECClassId + ":" + key.ECInstanceId;
    //     }
    //   default:
    //     {
    //       const key = <IGroupingNodeKey>keyBase;
    //       return key.NodeId;
    //     }
    // }
    if (item.key.classId && item.key.instanceId)
      return item.key.classId.toString() + " " + item.key.instanceId.toString();
    else if (item.key.classId)
      return item.key.classId.toString();
    else
      return "";
  }

  /** Initializes this set from the supplied array of SelectedItems. */
  public initFromArray(items: SelectedItem[]): void {
    this.clear();
    for (const item of items)
      this.add(item);
  }

  /** Initializes this set from another set of SelectedItems. */
  public initFromSet(set: SelectedItemsSet): void {
    this.clear();
    for (const key in set._dictionary) {
      if (set._dictionary.hasOwnProperty(key))
        this.add(set._dictionary[key]);
    }
  }

  /** Create an array from this set. */
  public asArray(): SelectedItem[] {
    const arr = new Array<SelectedItem>();
    for (const key in this._dictionary) {
      if (this._dictionary.hasOwnProperty(key))
        arr.push(this._dictionary[key]);
    }
    return arr;
  }

  /** @todo: */
  /*public remapNodeIds(remapInfo: { [from: string]: string }): void {
    const IsGroupingNodeKey = (key: SelectedItem): key is IGroupingNodeKey => { return 'NodeId' in key };
    for (let from in remapInfo) {
      let key: SelectedItem = this._dictionary[from];
      if (key && IsGroupingNodeKey(key)) {
        delete this._dictionary[from];
        key.NodeId = remapInfo[from];
        this._dictionary[SelectedItemSet.ToString(key)] = key;
      }
    }
  }*/

  /** Add a new key into this set. */
  public add(key: SelectedItem): void {
    const strKey = SelectedItemsSet.toString(key);
    if (!this._dictionary.hasOwnProperty(strKey)) {
      this._dictionary[strKey] = key;
      ++this._size;
    }
  }

  /** Remove the key from this set. */
  public remove(key: SelectedItem): void {
    const strKey = SelectedItemsSet.toString(key);
    if (this._dictionary.hasOwnProperty(strKey)) {
      delete this._dictionary[strKey];
      --this._size;
    }
  }

  /** Does this set contain the supplied key. */
  public contains(key: SelectedItem): boolean {
    return this._dictionary.hasOwnProperty(SelectedItemsSet.toString(key));
  }

  /** Removed all items from this set. */
  public clear(): void { this._dictionary = {}; this._size = 0; }

  /** Is this set empty. */
  public get isEmpty(): boolean { return 0 === this._size; }

  /** Get the size of this set. */
  public get size(): number { return this._size; }
}
