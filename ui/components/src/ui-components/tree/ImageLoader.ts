/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import { IImageLoader, LoadedImage } from "../common/IImageLoader";
import { BeInspireTreeNodeITree } from "./deprecated/component/BeInspireTree";
import { TreeNodeItem } from "./TreeDataProvider";

// tslint:disable:deprecation

// tslint:disable:deprecation

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
      sourceType: "webfont-icon",
      value: item.icon,
    };
  }
}
