/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { UiFramework } from "@itwin/appui-react";
import { Dialog } from "@itwin/core-react";
import { DialogButtonType } from "@itwin/appui-abstract";
import { AppUiTestProviders } from "../../AppUiTestProviders";

/**
 *  This is an example of how to create a React-based modal dialog that can be opened via a toolbutton or a key-in.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export function SampleModalDialog() {
  const title = React.useRef(AppUiTestProviders.translate("Dialogs.SampleModal.title"));

  const closeDialog = React.useCallback(() => {
    UiFramework.dialogs.modal.close();
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
