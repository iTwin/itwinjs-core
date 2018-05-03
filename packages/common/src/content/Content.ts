/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import Descriptor, { DescriptorJSON } from "./Descriptor";
import Item, { ItemJSON } from "./Item";

export interface ContentJSON {
  descriptor: DescriptorJSON;
  contentSet: ItemJSON[];
}

/** A struct that contains the Descriptor and a list of Item
 * objects which are based on that descriptor.
 */
export default class Content {
  public readonly descriptor!: Readonly<Descriptor>;
  public readonly contentSet!: Array<Readonly<Item>>;

  /* istanbul ignore next */
  private constructor() {}

  /*public toJSON(): ContentJSON {
    return {
      descriptor: this.descriptor.toJSON(),
      contentSet: this.contentSet.map((item: Item) => item.toJSON()),
    };
  }*/

  public static fromJSON(json: ContentJSON | string | undefined): Content | undefined {
    if (!json)
      return undefined;
    if (typeof json === "string")
      return JSON.parse(json, Content.reviver);
    const content = Object.create(Content.prototype);
    return Object.assign(content, {
      descriptor: Descriptor.fromJSON(json.descriptor),
      contentSet: json.contentSet.map((itemJson: ItemJSON) => Item.fromJSON(itemJson)),
    });
  }

  public static reviver(key: string, value: any): any {
    return key === "" ? Content.fromJSON(value) : value;
  }
}
