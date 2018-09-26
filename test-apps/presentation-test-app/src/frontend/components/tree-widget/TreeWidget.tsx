import * as React from "react";
import { IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { PresentationTreeDataProvider, withFilteringSupport, withUnifiedSelection } from "@bentley/presentation-components/lib/tree";
import { Tree, FilteringInput } from "@bentley/ui-components";
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
  highlightedCount: number;
  activeHighlightedIndex: number;
}

export default class TreeWidget extends React.Component<Props, State> {
  private _dataProvider: PresentationTreeDataProvider;

  constructor(props: Props) {
    super(props);
    this._dataProvider = new PresentationTreeDataProvider(props.imodel, props.rulesetId);
    this.state = {
      filter: "",
      filtering: false,
      prevProps: props,
      activeHighlightedIndex: 0,
      highlightedCount: 0,
    };
  }

  public static getDerivedStateFromProps(nextProps: Props, state: State) {
    if (nextProps.imodel !== state.prevProps.imodel || nextProps.rulesetId !== state.prevProps.rulesetId)
      return { ...state, prevProps: nextProps, filtering: true };
    return state;
  }

  // tslint:disable-next-line:naming-convention
  private onFilterApplied = (_filter?: string): void => {
    if (this.state.filtering)
      this.setState({ filtering: false });
  }

  private _onFilterStart = (filter: string) => {
    this.setState({ filter, filtering: true });
  }

  private _onFilterCancel = () => {
    this.setState({ filter: "", filtering: false });
  }

  private _onFilterClear = () => {
    this.setState({ filter: "", filtering: false });
  }

  private _onHighlightedCounted = (count: number) => {
    if (count !== this.state.highlightedCount)
      this.setState({ highlightedCount: count });
  }

  private _onFilteringInputSelectedChanged = (index: number) => {
    this.setState({ activeHighlightedIndex: index });
  }

  public render() {
    if (this.props.imodel !== this.state.prevProps.imodel || this.props.rulesetId !== this.state.prevProps.rulesetId)
      this._dataProvider = new PresentationTreeDataProvider(this.props.imodel, this.props.rulesetId);

    return (
      <div className="treewidget">
        <div className="treewidget-header">
          <h3>{IModelApp.i18n.translate("Sample:controls.tree")}</h3>
          <FilteringInput
            filteringInProgress={this.state.filtering}
            onFilterCancel={this._onFilterCancel}
            onFilterClear={this._onFilterClear}
            onFilterStart={this._onFilterStart}
            resultSelectorProps={{
              onSelectedChanged: this._onFilteringInputSelectedChanged,
              resultCount: this.state.highlightedCount,
            }} />
        </div>
        <SampleTree dataProvider={this._dataProvider} filter={this.state.filter}
          onFilterApplied={this.onFilterApplied}
          onHighlightedCounted={this._onHighlightedCounted}
          activeHighlightedIndex={this.state.activeHighlightedIndex} />
      </div>
    );
  }
}
