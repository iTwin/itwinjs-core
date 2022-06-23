/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import { useTransientState as useTransientStateImpl } from "@itwin/appui-layout-react";

/** Hook that allows to save and restore transient DOM state (i.e. scroll offset) of a widget.
 * @beta
 */
export function useTransientState(onSave?: () => void, onRestore?: () => void): void {
  useTransientStateImpl(onSave, onRestore);
}
