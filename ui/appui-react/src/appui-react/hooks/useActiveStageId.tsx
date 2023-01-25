/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Hooks
 */

import { useEffect, useState } from "react";
import { FrontstageActivatedEventArgs } from "../framework/FrameworkFrontstages";
import { UiFramework } from "../UiFramework";

/** React hook that maintains the active stage Id.
 * @public
 */
export function useActiveStageId(): string {
  const [activeStageId, setActiveStageId] = useState(UiFramework.frontstages.activeFrontstageId);
  useEffect(() => {
    const handleFrontstageActivatedEvent = (args: FrontstageActivatedEventArgs) => {
      setActiveStageId(args.activatedFrontstageDef.id);
    };

    UiFramework.frontstages.onFrontstageActivatedEvent.addListener(handleFrontstageActivatedEvent);
    return () => {
      UiFramework.frontstages.onFrontstageActivatedEvent.removeListener(handleFrontstageActivatedEvent);
    };
  }, []);
  return activeStageId;
}
