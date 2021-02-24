/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { ModalDialogManager } from "@bentley/ui-framework";
import { TraceUiItemsProvider } from "../NetworkTraceUIProvider";
import { Dialog, DialogButtonType } from "@bentley/ui-core";
import { BadgeType, ConditionalBooleanValue, IconSpecUtilities, ToolbarItemUtilities } from "@bentley/ui-abstract";
import connectedIcon from "../icons/connected-query.svg?sprite";

// eslint-disable-next-line @typescript-eslint/naming-convention
export function SampleModalDialog() {
  const title = React.useRef (TraceUiItemsProvider.translate("Dialogs.SampleModal.title"));

  const closeDialog = React.useCallback (() => {
    ModalDialogManager.closeDialog();
  }, []);

  const handleOK = React.useCallback(() => {
    // Do OK processing here
    closeDialog();
  }, [closeDialog]);

  const handleCancel = React.useCallback(() => {
    // Do Cancel processing here
    closeDialog();
  }, [closeDialog]);

  return (
    <Dialog
      title={title.current}
      opened={true}
      modal={true}
      width={450}
      height={300}
      onClose={handleCancel}
      onEscape={handleCancel}
      onOutsideClick={handleCancel}
      buttonCluster={[
        { type: DialogButtonType.OK, onClick: handleOK },
        { type: DialogButtonType.Cancel, onClick: handleCancel },
      ]}
    >
        Lorem ipsum dolor sit amet, posse imperdiet ius in, mundi cotidieque ei per.
        Vel scripta ornatus assentior cu. Duo nonumy equidem te, per ad malis deserunt consetetur.
        In per invidunt conceptam. Ea pri aeque corrumpit. Eum ea ipsum perfecto vulputate, an cum oblique ornatus.
    </Dialog >
  );
}

export function getTraceConnectedActionButton(itemPriority: number){
  const isDisabledCondition = new ConditionalBooleanValue(
    (): boolean => {
      return !TraceUiItemsProvider.isTraceAvailable;
    },
    [TraceUiItemsProvider.syncEventIdTraceAvailable],
    !TraceUiItemsProvider.isTraceAvailable
  );

  const actionButtonDef = ToolbarItemUtilities.createActionButton(
    "trace-tool-connected",
    itemPriority, /* order within group button */
    IconSpecUtilities.createSvgIconSpec(connectedIcon),
    TraceUiItemsProvider.translate("trace-tool-connected"),
    (): void => {
      ModalDialogManager.openDialog(<SampleModalDialog />);
    },
    {
      isDisabled: isDisabledCondition,
      badgeType: BadgeType.TechnicalPreview,
    }
  );
  return actionButtonDef;
}
