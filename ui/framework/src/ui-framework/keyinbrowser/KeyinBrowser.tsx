/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Common */

// cSpell:ignore Modeless keyins keyinbrowser testid
import * as React from "react";
import { LabeledSelect, LabeledInput, Button, CommonProps } from "@bentley/ui-core";
import { IModelApp, Tool } from "@bentley/imodeljs-frontend";
import { UiFramework } from "../UiFramework";
import "./KeyinBrowser.scss";

/**
 * Properties that hold state of key-in browser.
 * @alpha
 */
interface KeyinBrowserState {
  keyins: { [key: string]: string };
  currentToolId: string | undefined;
  currentArgs: string;
}

/** Properties of the [[KeyinBrowser]] component.
 * @alpha
 */
export interface KeyinBrowserProps extends CommonProps {
  onExecute?: () => void;
}

/**
 * Component used to allow user to select, provide arguments, and execute a key-in.
 * @alpha
 */
export class KeyinBrowser extends React.PureComponent<KeyinBrowserProps, KeyinBrowserState> {
  private _toolIdLabel = UiFramework.translate("keyinbrowser.keyin");
  private _argsLabel = UiFramework.translate("keyinbrowser.args");
  private _argsTip = UiFramework.translate("keyinbrowser.argsTip");
  private _executeLabel = UiFramework.translate("keyinbrowser.execute");
  private _toolIdKey = "keyinbrowser:keyin";

  /** @internal */
  constructor(props: any) {
    super(props);
    const currentToolId = this.getSavedToolId();
    const currentArgs = this.getToolArgs(currentToolId);

    this.state = {
      keyins: this.getToolKeyinMap(),
      currentToolId,
      currentArgs,
    };
  }

  private getArgsKey(toolId: string | undefined): string | undefined {
    if (toolId && toolId.length > 0)
      return `keyinbrowser:${toolId}`;
    return undefined;
  }

  private getSavedToolId(): string | undefined {
    const toolId = window.localStorage.getItem(this._toolIdKey);
    return toolId ? toolId : undefined;
  }

  private getToolArgs(toolId: string | undefined): string {
    const argsKey = this.getArgsKey(toolId);
    if (argsKey && argsKey.length > 0) {
      const args = window.localStorage.getItem(argsKey);
      if (args && args.length > 0 && args[0] === "[") {
        return (JSON.parse(args) as string[]).join("|");
      }
    }
    return "";
  }

  private getToolKeyinMap(): { [key: string]: string } {
    const keyins: { [key: string]: string } = {};
    IModelApp.tools.getToolList().sort((a: typeof Tool, b: typeof Tool) => a.keyin.localeCompare(b.keyin)).forEach((tool: typeof Tool) => keyins[tool.toolId] = tool.keyin);
    return keyins;
  }

  private getArgsArray(): string[] {
    // istanbul ignore else
    if (this.state.currentArgs.length > 0) {
      return this.state.currentArgs.split("|");
    }
    return [];
  }

  private _onClick = (_event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    // istanbul ignore else
    if (this.state.currentToolId && this.state.currentToolId.length > 0) {
      const foundTool = IModelApp.tools.find(this.state.currentToolId);
      // istanbul ignore else
      if (foundTool) {
        let key = "keyinbrowser:keyin";
        window.localStorage.setItem(key, foundTool.toolId);

        const args = this.getArgsArray();
        // istanbul ignore else
        if (args && args.length > 0) {
          key = `keyinbrowser:${foundTool.toolId}`;
          const objectAsString = JSON.stringify(args);
          window.localStorage.setItem(key, objectAsString);
        }

        IModelApp.tools.run(foundTool.toolId, args);
      }
    }
    this.props.onExecute && this.props.onExecute();
  }

  private _onKeyinSelected = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    const currentToolId = event.target.value;
    const currentArgs = this.getToolArgs(currentToolId);
    this.setState({ currentToolId, currentArgs });
  }

  private _onArgumentsChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    this.setState({ currentArgs: event.target.value });
  }

  /** @internal */
  public render(): React.ReactNode {
    return (
      <div className="uif-keyinbrowser-div">
        <LabeledSelect label={this._toolIdLabel} data-testid="uif-keyin-select" id="uif-keyin-select" value={this.state.currentToolId} onChange={this._onKeyinSelected} options={this.state.keyins} />
        <LabeledInput label={this._argsLabel} title={this._argsTip} value={this.state.currentArgs} data-testid="uif-keyin-arguments" id="uif-keyin-arguments" type="text" onChange={this._onArgumentsChange} />
        <Button data-testid="uif-keyin-browser-execute" onClick={this._onClick}>{this._executeLabel}</Button>
      </div>
    );
  }
}
