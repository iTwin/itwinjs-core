/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Dialog */

import * as React from "react";
import { Dialog, DialogProps } from "@bentley/ui-core";
import { ModelessDialogManager } from "./ModelessDialogManager";

/** Properties for the [[ModelessDialog]] component
 * @public
 */
export interface ModelessDialogProps extends DialogProps {
  dialogId: string;
}

/** Modeless Dialog React component
 * @public
 */
export class ModelessDialog extends React.Component<ModelessDialogProps> {
  constructor(props: ModelessDialogProps) {
    super(props);
  }

  public render(): JSX.Element {
    const { dialogId, style, modal, modelessId, onModelessPointerDown, ...props } = this.props;

    return (
      <Dialog
        {...props}
        modal={false}
        modelessId={dialogId}
        onModelessPointerDown={(event) => ModelessDialogManager.handlePointerDownEvent(event, dialogId, this._updateDialog)}
        style={{ zIndex: ModelessDialogManager.getDialogZIndex(dialogId), ...style }}
      >
        {this.props.children}
      </Dialog >
    );
  }

  private _updateDialog = () => {
    this.forceUpdate();
  }
}
