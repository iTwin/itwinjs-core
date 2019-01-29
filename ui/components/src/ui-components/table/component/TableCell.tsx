import * as React from "react";
import classnames from "classnames";
import { Omit } from "@bentley/ui-core";
import { EditorContainerProps, EditorContainer, CellItem, PropertyValueRendererManager, PropertyDialogState, ColorOverrides, PropertyValueRendererContext, PropertyContainerType } from "../../../ui-components";
import { colorDecimalToHex } from "./Table";

import "./TableCell.scss";

/**
 * Properties of the [[TableCell]] React component
 */
export interface TableCellProps {
  /** Additinional class name for the cell container */
  className?: string;
  /** Title of the cell container */
  title: string;
  /** Cell content */
  children?: React.ReactNode;
  /** Click event callback */
  onClick?: (e: React.MouseEvent) => void;
  /** MouseMove event callback */
  onMouseMove?: (e: React.MouseEvent) => void;
  /** MouseDown event callback */
  onMouseDown?: (e: React.MouseEvent) => void;
  /** Properties for [[EditorContainer]]. Activates cell editing and provides properties to the container */
  cellEditingProps?: Omit<EditorContainerProps, "title">;
}

/**
 * A React component that renders a table cell
 */
export class TableCell extends React.PureComponent<TableCellProps> {
  public render() {
    if (this.props.cellEditingProps)
      return (
        <EditorContainer
          title={this.props.title}
          {...this.props.cellEditingProps}
        />
      );

    return (
      <div
        className={classnames("components-table-cell", this.props.className)}
        title={this.props.title}
        onClick={this.props.onClick}
        onMouseMove={this.props.onMouseMove}
        onMouseDown={this.props.onMouseDown}
      >
        {this.props.children}
      </div>
    );
  }
}

/** Properties of the [[TableCellContent]] React component */
export interface TableCellContentProps {
  /** Indicates, whether container cell is selected or not */
  isSelected: boolean;
  /** Props for the item that will be rendered */
  cellItem: CellItem;
  /** Height of the component */
  height?: number;
  /** Callback to DialogOpen event */
  onDialogOpen?: (state: PropertyDialogState) => void;
  /** Property value renderer manager */
  propertyValueRendererManager: PropertyValueRendererManager;
}

/** State of the [[TableCellContent]] React component */
export interface TableCellContentState {
  /** Rendererd content */
  content: React.ReactNode;
}

/** A React component that renders table cell content */
export class TableCellContent extends React.PureComponent<TableCellContentProps, TableCellContentState> {
  public readonly state: TableCellContentState = {
    content: <div style={this.getStyle(this.props.cellItem, this.props.isSelected, this.props.height)} />,
  };

  private _isMounted = false;

  private getBackgroundColor(isSelected: boolean, colorOverrides?: ColorOverrides) {
    if (!colorOverrides)
      return undefined;

    if (isSelected)
      return colorOverrides.backColorSelected !== undefined
        ? colorDecimalToHex(colorOverrides.backColorSelected)
        : undefined;

    if (colorOverrides.backColor)
      return colorDecimalToHex(colorOverrides.backColor);

    return undefined;
  }

  private getForegroundColor(isSelected: boolean, colorOverrides?: ColorOverrides) {
    if (!colorOverrides)
      return undefined;

    if (isSelected)
      return colorOverrides.foreColorSelected !== undefined
        ? colorDecimalToHex(colorOverrides.foreColorSelected)
        : undefined;

    if (colorOverrides.foreColor)
      return colorDecimalToHex(colorOverrides.foreColor);

    return undefined;
  }

  private getStyle(cellItem: CellItem, isSelected: boolean, height?: number): React.CSSProperties {
    const { colorOverrides, isBold, isItalic, alignment } = cellItem;

    return {
      color: this.getForegroundColor(isSelected, colorOverrides),
      backgroundColor: this.getBackgroundColor(isSelected, colorOverrides),
      fontWeight: isBold ? "bold" : undefined,
      fontStyle: isItalic ? "italic" : undefined,
      textAlign: alignment,
      height,
    };
  }

  private async renderContent(props: TableCellContentProps) {
    const style = this.getStyle(props.cellItem, props.isSelected, props.height);

    if (!props.cellItem.record)
      return <div style={style} />;

    const rendererContext: PropertyValueRendererContext = {
      containerType: PropertyContainerType.Table,
      onDialogOpen: this.props.onDialogOpen,
      style,
      // TODO: Enable, when table gets refactored. Explanation in ./../table/NonPrimitiveValueRenderer
      // onPopupShow: this._onPopupShow,
      // onPopupHide: this._onPopupHide,
    };

    return this.props.propertyValueRendererManager.render(props.cellItem.record, rendererContext);
  }

  private doPropsDiffer(props1: TableCellContentProps, props2: TableCellContentProps) {
    return props1.cellItem !== props2.cellItem
      || props1.isSelected !== props2.isSelected
      || props1.onDialogOpen !== props2.onDialogOpen
      || props1.propertyValueRendererManager !== props2.propertyValueRendererManager;
  }

  public async componentDidMount() {
    this._isMounted = true;
    const content = await this.renderContent(this.props);

    if (this._isMounted)
      this.setState({ content });
  }

  public componentWillUnmount() {
    this._isMounted = false;
  }

  public async componentDidUpdate(prevProps: TableCellContentProps) {
    if (this.doPropsDiffer(prevProps, this.props)) {
      const content = await this.renderContent(this.props);

      if (this._isMounted)
        this.setState({ content });
    }
  }

  public render() {
    return this.state.content;
  }
}

/** Properties for the [[TableIconCellContent]] React component  */
export interface TableIconCellContentProps {
  /** Icon name */
  iconName: string;
}

/**
 * A React component that renders table cell content as a Bentley icon
 */
export class TableIconCellContent extends React.PureComponent<TableIconCellContentProps> {
  public render() {
    return <div className={`icon ${this.props.iconName}`} />;
  }
}
