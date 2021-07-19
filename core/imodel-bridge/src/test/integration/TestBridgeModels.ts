/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { GroupInformationModel } from "@bentley/imodeljs-backend";

/** A container for persisting AnalyticalElement instances used to model a specialized analytical perspective.
 * @beta
 */
export abstract class TestBridgeGroupModel extends GroupInformationModel {
  /** @internal */
  public static override get className(): string { return "TestBridgeGroupModel"; }
}
