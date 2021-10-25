/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Workspace
 */

export type WorkspaceContainerAlias = string;
export type WorkspaceContainerId = string;
export type WorkspaceResourceName = string;
export type WorkspaceResourceType = "string" | "blob" | "file";

export type ContainerUrl =
  { alias: string, id?: string } |
  { alias?: string, id: string };

export interface WorkspaceResourceProps {
  containerId: WorkspaceContainerId;
  type: WorkspaceResourceType;
  name: WorkspaceResourceName;
}

const a: ContainerUrl = { id: "v" };

console.log(a);
export class Workspace {

}
