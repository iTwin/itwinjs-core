/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import Node from "./Node";

/** Describes a single step in the nodes path. */
export default interface NodePathElement {
  node: Node;
  index: number;
  isMarked: boolean;
  children: NodePathElement[];
}
