/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as React from "react";

import ConfigurableUiManager from "./ConfigurableUiManager";
import { ToolWidgetProps, WidgetType } from "./WidgetDef";
import { ToolbarWidgetDefBase } from "./ToolbarWidgetBase";
import { Icon } from "./IconLabelSupport";
import { FrontstageManager, ToolActivatedEventArgs } from "./FrontstageManager";

import NZ_AppButton from "@bentley/ui-ninezone/lib/toolbar/button/App";
import NZ_ToolsWidget from "@bentley/ui-ninezone/lib/widget/Tools";

/** A Tool Widget normally displayed in the top left zone in the 9-Zone Layout system.
 */
export class ToolWidgetDef extends ToolbarWidgetDefBase {
  private _appButtonId: string;
  private _reactElement: React.ReactNode;

  constructor(def: ToolWidgetProps) {
    super(def);

    this._appButtonId = (def.appButtonId !== undefined) ? def.appButtonId : "";

    this.widgetType = WidgetType.Tool;
  }

  public executeAppButtonClick = (): void => {
    const appButton = ConfigurableUiManager.findItem(this._appButtonId);
    if (appButton) {
      appButton.execute();
    }
  }

  public get reactElement(): React.ReactNode {
    if (!this._reactElement)
      this._reactElement = <ToolWidgetWithDef toolWidgetDef={this} />;

    return this._reactElement;
  }

  public renderCornerItem(): React.ReactNode | undefined {
    const appButton = ConfigurableUiManager.findItem(this._appButtonId);

    if (appButton) {
      return (
        <NZ_AppButton
          onClick={this.executeAppButtonClick}
          icon={
            <Icon iconInfo={appButton.iconInfo} />
          }
        />
      );
    }

    return undefined;
  }
}

/** Props for the ToolWidget React component.
 */
export interface ToolWidgetPropsEx extends ToolWidgetProps {
  button?: React.ReactNode;
  horizontalToolbar?: React.ReactNode;
  verticalToolbar?: React.ReactNode;
}

export interface ToolWidgetState {
  toolWidgetProps: ToolWidgetPropsEx;
  toolWidgetDef: ToolWidgetDef;
}

/** ToolWidget React component.
 */
export class ToolWidget extends React.Component<ToolWidgetPropsEx, ToolWidgetState> {

  /** hidden */
  public readonly state: Readonly<ToolWidgetState>;

  constructor(props: ToolWidgetPropsEx, context?: any) {
    super(props, context);

    this.state = { toolWidgetProps: props, toolWidgetDef: new ToolWidgetDef(props) };
  }

  public static getDerivedStateFromProps(newProps: ToolWidgetPropsEx, state: ToolWidgetState): ToolWidgetState | null {
    if (newProps !== state.toolWidgetProps) {
      return { toolWidgetProps: newProps, toolWidgetDef: new ToolWidgetDef(newProps) };
    }

    return null;
  }

  public render(): React.ReactNode {
    return (
      <ToolWidgetWithDef
        toolWidgetDef={this.state.toolWidgetDef}
        button={this.props.button}
        horizontalToolbar={this.props.horizontalToolbar}
        verticalToolbar={this.props.verticalToolbar}
      />
    );
  }
}

/** Props for the Tool Widget React component.
 */
interface Props {
  toolWidgetDef: ToolWidgetDef;
  button?: React.ReactNode;
  horizontalToolbar?: React.ReactNode;
  verticalToolbar?: React.ReactNode;
}

/** Tool Widget React component.
 */
class ToolWidgetWithDef extends React.Component<Props> {
  constructor(props: Props) {
    super(props);
  }

  private handleToolActivatedEvent = (args: ToolActivatedEventArgs): void => {
    this.setState((_prevState, _props) => {
      const toolId = args.toolId;
      return {
        toolId,
      };
    });
  }

  public componentDidMount() {
    FrontstageManager.ToolActivatedEvent.addListener(this.handleToolActivatedEvent);
  }

  public componentWillUnmount() {
    FrontstageManager.ToolActivatedEvent.removeListener(this.handleToolActivatedEvent);
  }

  public render(): React.ReactNode {
    this.props.toolWidgetDef.resolveItems();

    const button = (this.props.button !== undefined) ? this.props.button : this.props.toolWidgetDef.renderCornerItem();
    const horizontalToolbar = (this.props.horizontalToolbar) ? this.props.horizontalToolbar : this.props.toolWidgetDef.renderHorizontalToolbar();
    const verticalToolbar = (this.props.verticalToolbar) ? this.props.verticalToolbar : this.props.toolWidgetDef.renderVerticalToolbar();

    return (
      <NZ_ToolsWidget
        button={button}
        horizontalToolbar={horizontalToolbar}
        verticalToolbar={verticalToolbar}
      />
    );
  }
}

export default ToolWidget;
