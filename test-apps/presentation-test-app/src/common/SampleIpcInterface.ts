
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64Arg } from "@itwin/core-bentley";
import { ElementProps } from "@itwin/core-common";

/** @internal */
export const PRESENTATION_TEST_APP_IPC_CHANNEL_NAME = "presentation-test-app-ipc-interface";

/** @internal */
export interface SampleIpcInterface {
  updateElement(imodelKey: string, newProps: ElementProps): Promise<void>;
  deleteElements(imodelKey: string, elementIds: Id64Arg): Promise<void>;
}
