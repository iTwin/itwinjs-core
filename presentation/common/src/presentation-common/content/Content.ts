/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Content
 */

import type { DescriptorJSON } from "./Descriptor";
import { Descriptor } from "./Descriptor";
import type { ItemJSON } from "./Item";
import { Item } from "./Item";

/**
 * Serialized [[Content]] JSON representation.
 * @public
 */
export interface ContentJSON {
  descriptor: DescriptorJSON;
  contentSet: ItemJSON[];
}

/**
 * A data structure that contains the [[Descriptor]] and a list of [[Item]]
 * objects which are based on that descriptor.
 *
 * @public
 */
export class Content {
  /** Descriptor used to create the content */
  public readonly descriptor: Descriptor;
  /** Content items */
  public readonly contentSet: Item[];

  /** Create a new [[Content]] instance */
  public constructor(descriptor: Descriptor, items: Item[]) {
    this.descriptor = descriptor;
    this.contentSet = items;
  }

  /** Serialize this object to JSON */
  public toJSON(): ContentJSON {
    return {
      descriptor: this.descriptor.toJSON(),
      contentSet: this.contentSet.map((item: Item) => item.toJSON()),
    };
  }

  /** Deserialize [[Content]] from JSON */
  public static fromJSON(json: ContentJSON | string | undefined): Content | undefined {
    if (!json)
      return undefined;

    if (typeof json === "string")
      return JSON.parse(json, Content.reviver);

    const descriptor = Descriptor.fromJSON(json.descriptor);
    if (!descriptor)
      return undefined;

    const contentSet = json.contentSet
      .map((itemJson: ItemJSON) => Item.fromJSON(itemJson))
      .filter<Item>((item): item is Item => (item !== undefined));
    return new Content(descriptor, contentSet);
  }

  /**
   * Reviver function that can be used as a second argument for
   * `JSON.parse` method when parsing Content objects.
   *
   * @internal
   */
  public static reviver(key: string, value: any): any {
    return key === "" ? Content.fromJSON(value) : value;
  }
}
