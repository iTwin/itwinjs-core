/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Hooks
 */

import { useEffect, useState } from "react";
import type { FrontstageActivatedEventArgs} from "../frontstage/FrontstageManager";
import { FrontstageManager } from "../frontstage/FrontstageManager";

/** React hook that maintains the active stage Id.
 * @public
 */
export function useActiveStageId(): string {
  const [activeStageId, setActiveStageId] = useState(FrontstageManager.activeFrontstageId);
  useEffect(() => {
    const handleFrontstageActivatedEvent = (args: FrontstageActivatedEventArgs) => {
      setActiveStageId(args.activatedFrontstageDef.id);
    };

    FrontstageManager.onFrontstageActivatedEvent.addListener(handleFrontstageActivatedEvent);
    return () => {
      FrontstageManager.onFrontstageActivatedEvent.removeListener(handleFrontstageActivatedEvent);
    };
  }, []);
  return activeStageId;
}
