/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { IModelApp } from "@bentley/imodeljs-frontend";
import { IStatusBar, StatusBarFieldId } from "@bentley/ui-framework";
import ToolAssistanceIndicator from "@bentley/ui-ninezone/lib/footer/tool-assistance/Indicator";
import IndicatorDialog from "@bentley/ui-ninezone/lib/footer/indicator-dialog/Dialog";

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
          <IndicatorDialog isOpen={this.props.openWidget === this._className} />
        }
        icons={
          <>
            <i className="icon icon-placeholder" />
            <i className="icon icon-placeholder" />
          </>
        }
        isStepStringVisible={this.props.isInFooterMode}
        onIndicatorClick={this.handleToolAssistanceIndicatorClick}
        stepString={IModelApp.i18n.translate("SampleApp:toolAssist.startPoint")}
      />
    );
  }

  private handleToolAssistanceIndicatorClick = () => {
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
