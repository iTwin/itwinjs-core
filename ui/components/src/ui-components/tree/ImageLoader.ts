/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import { IImageLoader, LoadedImage } from "../common/IImageLoader";
import { TreeNodeItem } from "./TreeDataProvider";
import { BeInspireTreeNodeITree } from "./component/BeInspireTree";

/** Interface for a tree image loader
 * @public
 */
export interface ITreeImageLoader extends IImageLoader {
  load: (item: TreeNodeItem | BeInspireTreeNodeITree) => LoadedImage | undefined;
}

/** Default image loader for the tree
 * @public
 */
export class TreeImageLoader implements ITreeImageLoader {
  /** Loads image data from either [[TreeNodeItem]] or [[BeInspireTreeNodeITree]] */
  public load(item: TreeNodeItem | BeInspireTreeNodeITree): LoadedImage | undefined {
    if (!item.icon)
      return undefined;

    return {
      sourceType: "core-icon",
      value: item.icon,
    };
  }
}
