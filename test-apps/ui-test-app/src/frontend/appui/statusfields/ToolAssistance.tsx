/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { IModelApp } from "@bentley/imodeljs-frontend";
import { IStatusBar, StatusBarFieldId, FrontstageManager } from "@bentley/ui-framework";
import ToolAssistanceIndicator from "@bentley/ui-ninezone/lib/footer/tool-assistance/Indicator";
import ToolAssistanceDialog from "@bentley/ui-ninezone/lib/footer/tool-assistance/Dialog";

export interface ToolAssistanceProps {
  statusBar: IStatusBar;
  isInFooterMode: boolean;
  openWidget: StatusBarFieldId;
}

/** Tool Assistance Field React component.
 */
export class ToolAssistanceField extends React.Component<ToolAssistanceProps> {
  private _className: string;

  constructor(p: ToolAssistanceProps) {
    super(p);

    const instance = this.constructor;
    this._className = instance.name;
  }

  // TODO !!!
  public render(): React.ReactNode {
    return (
      <ToolAssistanceIndicator
        dialog={
          this.props.openWidget !== this._className ? undefined : (
            <ToolAssistanceDialog
              title={IModelApp.i18n.translate("SampleApp:toolAssist.title")}
              items={FrontstageManager.activeToolAssistanceNode}
            />
          )
        }
        icons={
          <>
            <i className="icon icon-placeholder" />
            <i className="icon icon-placeholder" />
          </>
        }
        isStepStringVisible={this.props.isInFooterMode}
        onClick={this._handleToolAssistanceIndicatorClick}
        stepString={IModelApp.i18n.translate("SampleApp:toolAssist.startPoint")}
      />
    );
  }

  private _handleToolAssistanceIndicatorClick = () => {
    const isOpen = this.props.openWidget === this._className;
    if (isOpen)
      this.setOpenWidget(null);
    else
      this.setOpenWidget(this._className);
  }

  private setOpenWidget(openWidget: StatusBarFieldId) {
    this.props.statusBar.setOpenWidget(openWidget);
  }
}
