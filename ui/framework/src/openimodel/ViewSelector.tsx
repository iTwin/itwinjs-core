/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module OpenIModel */

import * as React from "react";
import { CSSProperties } from "react";
import "./ViewSelector.scss";
import { ViewDefinitionProps } from "@bentley/imodeljs-common";

/** Properties for the ViewCheckbox component */
export interface ViewCheckboxProps {
  view: ViewDefinitionProps;
  onSelectView: (checked: boolean) => void;
}

/** ViewCheckbox React component */
class ViewCheckbox extends React.Component<ViewCheckboxProps> {
  constructor(props?: any, _context?: any) {
    super(props.component);
  }

  private onChange(event: any) {
    this.props.onSelectView(event.target.checked);
  }

  public render() {
    let name: string | undefined = this.props.view.code!.value;
    if (!name)
      return undefined;
    let lastIndex: number;
    if ((name.length > 30) && (-1 !== (lastIndex = name.lastIndexOf("\\"))))
      name = name.substring(lastIndex + 1);

    return (
      <div>
        <input id={name} type="checkbox" onChange={this.onChange.bind(this)} />
        <label className="fw-viewcheckbox-label" htmlFor={name}>{name}</label>
      </div >
    );
  }
}

/** Properties for the ViewSelector component */
export interface ViewSelectorProps {
  iModelCardRect: DOMRect;
  viewList: ViewDefinitionProps[];
  viewsPicked: (viewsOnOff: boolean[]) => void;
}

export interface ViewSelectorState {
  viewsOnOff: boolean[];
}

/** ViewSelector React component */
export class ViewSelector extends React.Component<ViewSelectorProps, ViewSelectorState> {

  public readonly state: Readonly<ViewSelectorState>;

  constructor(props: ViewSelectorProps) {
    super(props);
    this.state = {
      viewsOnOff: new Array<boolean>(props.viewList.length),
    };
  }

  // this is called every time another view is picked.
  private selectView(viewIndex: number, isChecked: boolean): any {
    this.setState((prevState: ViewSelectorState, _prevProps: ViewSelectorProps) => {
      const viewsOnOff: boolean[] = prevState.viewsOnOff.slice();
      viewsOnOff[viewIndex] = isChecked;
      return { viewsOnOff };
    });
  }

  // this is called to determine whether there are any views selected.
  private noViewsSelected(): boolean {
    if (!this.state.viewsOnOff || (0 === this.state.viewsOnOff.length))
      return true;
    for (const thisOnOff of this.state.viewsOnOff) {
      if (thisOnOff)
        return false;
    }
    return true;
  }

  private viewsPicked(): void {
    this.props.viewsPicked(this.state.viewsOnOff);
  }

  public render(): any {
    const elements = this.props.viewList.map((thisView, thisIndex) => {
      return (
        <ViewCheckbox view={thisView} key={thisView.code!.value} onSelectView={this.selectView.bind(this, thisIndex)} />
      );
    });

    const leftValue = this.props.iModelCardRect.left + this.props.iModelCardRect.width / 2;
    const topValue = this.props.iModelCardRect.top + 40;
    const divStyle: CSSProperties = {
      left: leftValue.toString() + "px",
      top: topValue.toString() + "px",
    };
    return (
      <div className="fw-viewselector-div" style={divStyle}>
        <form className="fw-viewselector-form" action="javascript:void(0)">
          <p className="fw-viewselector-paragraph">Select Views to Display</p>
          {elements}
          <button disabled={this.noViewsSelected()} className="fw-viewselector-button" onClick={this.viewsPicked.bind(this)} > Ok</button>
        </form >
      </div >
    );
  }
}
