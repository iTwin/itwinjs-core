/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ContextMenu
 */

import * as React from "react";

/** Finds a tilde character in ContextMenu item label for hot key support
 * @internal
 */
export class TildeFinder {
  /**
   * Find character following a tilde character within a React.ReactNode.
   * @param node react node to search within for a tilde.
   * @returns character that was found, and the same node with tilde removed, and following character with an underline.
   */
  public static findAfterTilde = (node: React.ReactNode): { character: string | undefined, node: React.ReactNode } => {
    if (typeof node === "string") {
      // String
      const tildeIndex = node.indexOf("~");
      if (tildeIndex !== -1 && tildeIndex <= node.length - 2) {
        const ch = node.charAt(tildeIndex + 1);
        const s1 = node.substring(0, tildeIndex);
        const n = <u key="hotkey">{ch}</u>;
        const s2 = node.substring(tildeIndex + 2);
        return { character: ch.toUpperCase(), node: [s1, n, s2] };
      }
    } else if (node && typeof node === "object") {
      if (Array.isArray(node)) {
        // Array
        let ret: { character: string | undefined, node: React.ReactNode } = { character: undefined, node };
        node = node.map((child) => {
          const r = TildeFinder.findAfterTilde(child);
          if (r.character) { // if character is found, modify node instead of returning unmodified child.
            ret = r;
            return r.node;
          }
          return child;
        });
        if (ret.character) {
          return { character: ret.character, node };
        }
      } else if ("props" in node) {
        // React Node
        const ret: { character: string | undefined, node: React.ReactNode } = { character: undefined, node };
        ret.node = React.cloneElement(node, {
          children: React.Children.map(node.props.children as React.ReactNode, (child: React.ReactNode) => {
            const r = TildeFinder.findAfterTilde(child);
            if (r.character) { // if character is found, modify node instead of returning unmodified child.
              ret.character = r.character;
              return r.node;
            }
            return child;
          }),
        });
        if (ret.character) {
          return ret;
        }
      }
    }
    return { character: undefined, node };
  };
}
