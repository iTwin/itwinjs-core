/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Frontstage
 */
import * as React from "react";
import { FrontstageManager, ModalFrontstageChangedEventArgs, ModalFrontstageInfo } from "../frontstage/FrontstageManager";
import { ModalFrontstage } from "../frontstage/ModalFrontstage";

/** @internal */
export function useActiveModalFrontstageInfo() {
  const [activeModalFrontstageInfo, setActiveModalFrontstageInfo] = React.useState(FrontstageManager.activeModalFrontstage);
  React.useEffect(() => {
    const handleModalFrontstageChangedEvent = (args: ModalFrontstageChangedEventArgs) => {
      setActiveModalFrontstageInfo(args.modalFrontstageCount === 0 ? undefined : FrontstageManager.activeModalFrontstage);
    };
    FrontstageManager.onModalFrontstageChangedEvent.addListener(handleModalFrontstageChangedEvent);
    return () => {
      FrontstageManager.onModalFrontstageChangedEvent.removeListener(handleModalFrontstageChangedEvent);
    };
  }, [setActiveModalFrontstageInfo]);
  return activeModalFrontstageInfo;
}

/** @internal */
export function ModalFrontstageComposer({ stageInfo }: { stageInfo: ModalFrontstageInfo | undefined }) {
  const handleCloseModal = React.useCallback(/* istanbul ignore next */() => FrontstageManager.closeModalFrontstage(), []);
  // istanbul ignore next
  if (!stageInfo)
    return null;

  const { title, content, appBarRight } = stageInfo;

  return <ModalFrontstage
    isOpen={true}
    title={title}
    closeModal={handleCloseModal}
    appBarRight={appBarRight}
  >
    {content}
  </ModalFrontstage>;
}
