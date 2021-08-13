/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { CodeProps, SubCategoryAppearance } from "@bentley/imodeljs-common";
import { Id64String } from "@bentley/bentleyjs-core";

export const fullstackIpcChannel = "fullStackIpc";
export interface FullStackTestIpc {
  createAndInsertPhysicalModel(key: string, newModelCode: CodeProps): Promise<Id64String>;
  createAndInsertSpatialCategory(key: string, scopeModelId: Id64String, categoryName: string, appearance: SubCategoryAppearance.Props): Promise<Id64String>;
}
