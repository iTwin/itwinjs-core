/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Content */

import Descriptor, { DescriptorJSON } from "./Descriptor";
import Item, { ItemJSON } from "./Item";

/**
 * Serialized [[Content]] JSON representation.
 */
export interface ContentJSON {
  descriptor: DescriptorJSON;
  contentSet: ItemJSON[];
}

/**
 * A data structure that contains the [[Descriptor]] and a list of [[Item]]
 * objects which are based on that descriptor.
 */
export default class Content {
  /** Descriptor used to create the content */
  public descriptor: Readonly<Descriptor>;
  /** Content items */
  public contentSet: Array<Readonly<Item>>;

  /* istanbul ignore next */
  private constructor(descriptor: Readonly<Descriptor>, items: Array<Readonly<Item>>) {
    this.descriptor = descriptor;
    this.contentSet = items;
  }

  /*public toJSON(): ContentJSON {
    return {
      descriptor: this.descriptor.toJSON(),
      contentSet: this.contentSet.map((item: Item) => item.toJSON()),
    };
  }*/

  /**
   * Deserialize Content from JSON
   * @param json JSON or JSON serialized to string to deserialize from
   * @returns Deserialized content or undefined if deserialization failed
   */
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

  /**
   * Reviver function that can be used as a second argument for
   * `JSON.parse` method when parsing Content objects.
   */
  public static reviver(key: string, value: any): any {
    return key === "" ? Content.fromJSON(value) : value;
  }
}
