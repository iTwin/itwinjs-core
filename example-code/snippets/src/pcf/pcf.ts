/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { EntityClassProps, RelationshipClassProps } from "@itwin/ecschema-metadata";

export type ECDynamicEntityClassProps = (EntityClassProps & { name: string, baseClass: string });
export type ECDynamicElementAspectClassProps = (EntityClassProps & { name: string, baseClass: string });
export type ECDynamicRelationshipClassProps = RelationshipClassProps;

export enum ItemState {
  New,
  Changed,
  Unchanged
}
