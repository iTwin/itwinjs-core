import * as React from "react";
import { IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { PresentationTreeDataProvider, withFilteringSupport, withUnifiedSelection } from "@bentley/presentation-components/lib/tree";
import { Tree } from "@bentley/ui-components";
import "./TreeWidget.css";

// tslint:disable-next-line:variable-name naming-convention
const SampleTree = withFilteringSupport(withUnifiedSelection(Tree));

export interface Props {
  imodel: IModelConnection;
  rulesetId: string;
}

export interface State {
  filter: string;
  filtering: boolean;
  prevProps: Props;
}
export default class TreeWidget extends React.Component<Props, State> {
  private _filterTextBox: React.RefObject<HTMLInputElement>;
  private _dataProvider: PresentationTreeDataProvider;

  constructor(props: Props) {
    super(props);
    this._dataProvider = new PresentationTreeDataProvider(props.imodel, props.rulesetId);
    this.state = { filter: "", filtering: false, prevProps: props };
    this._filterTextBox = React.createRef();
  }

  public static getDerivedStateFromProps(nextProps: Props, state: State) {
    if (nextProps.imodel !== state.prevProps.imodel || nextProps.rulesetId !== state.prevProps.rulesetId)
      return { ...state, prevProps: nextProps, filtering: true };
    return state;
  }

  private _onFilterButtonClick = (_e: React.MouseEvent<HTMLButtonElement>): void => {
    this.setFilter();
  }

  private _onFilterKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.keyCode === 13)
      this.setFilter();
  }

  private setFilter(): void {
    const text = this._filterTextBox.current!.value;
    this.setState({ filter: text, filtering: true });
  }

  // tslint:disable-next-line:naming-convention
  private onFilterApplied = (_filter?: string): void => {
    if (this.state.filtering)
      this.setState({ filtering: false });
  }

  public render() {
    if (this.props.imodel !== this.state.prevProps.imodel || this.props.rulesetId !== this.state.prevProps.rulesetId)
      this._dataProvider = new PresentationTreeDataProvider(this.props.imodel, this.props.rulesetId);

    const loader = this.state.filtering === true ? <div className="treeWidgetLoader" /> : undefined;
    return (
      <div className="TreeWidget">
        <h3>{IModelApp.i18n.translate("Sample:controls.tree")}</h3>
        <input type="text" ref={this._filterTextBox} onKeyDown={this._onFilterKeyDown} />
        <button onClick={this._onFilterButtonClick}>Filter</button>
        {loader}
        <SampleTree dataProvider={this._dataProvider} filter={this.state.filter}
          onFilterApplied={this.onFilterApplied} />
      </div>
    );
  }
}
