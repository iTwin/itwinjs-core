/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StagePanels
 */

/** Properties used by [[StagePanelManager]].
 * @internal
 */
export interface StagePanelManagerProps {
  readonly size: number | undefined;
  readonly isCollapsed: boolean;
}

/** Returns default [[StagePanelManagerProps]] object.
 * @internal
 */
export const getDefaultStagePanelManagerProps = (): StagePanelManagerProps => ({
  isCollapsed: false,
  size: undefined,
});

/** Class used to manage [[StagePanelManagerProps]].
 * @internal
 */
export class StagePanelManager {
  private _minSize = 200;
  private _maxSize = 600;
  private _collapseOffset = 100;

  public resize<TProps extends StagePanelManagerProps>(resizeBy: number, props: TProps): TProps {
    if (props.size === undefined)
      return props;

    const isCollapsed = this.shouldCollapse(resizeBy, props);
    const newProps = this.setIsCollapsed(isCollapsed, props);
    if (newProps !== props) {
      return this.setSize(isCollapsed ? this.minSize : props.size, newProps);
    }
    if (isCollapsed)
      return newProps;

    const size = this.limitSize(props.size + resizeBy);
    return this.setSize(size, newProps);
  }

  public setIsCollapsed<TProps extends StagePanelManagerProps>(isCollapsed: boolean, props: TProps): TProps {
    if (isCollapsed === props.isCollapsed)
      return props;
    return {
      ...props,
      isCollapsed,
    };
  }

  public setSize<TProps extends StagePanelManagerProps>(newSize: number, props: TProps): TProps {
    const size = this.limitSize(newSize);
    if (size === props.size)
      return props;

    return {
      ...props,
      size,
    };
  }

  public shouldCollapse(resizeBy: number, props: StagePanelManagerProps) {
    if (props.isCollapsed)
      return resizeBy < this.collapseOffset;
    if (props.size) {
      const requestedSize = props.size + resizeBy;
      if (requestedSize <= Math.max(this.minSize - this.collapseOffset, 0))
        return true;
    }
    return false;
  }

  public get minSize() {
    return this._minSize;
  }

  public set minSize(size: number) {
    this._minSize = size;
  }

  public get maxSize() {
    return this._maxSize;
  }

  public set maxSize(size: number) {
    this._maxSize = size;
  }

  public get collapseOffset() {
    return this._collapseOffset;
  }

  public set collapseOffset(offset: number) {
    this._collapseOffset = offset;
  }

  private limitSize(requestedSize: number) {
    return Math.min(Math.max(requestedSize, this.minSize), this.maxSize);
  }
}
