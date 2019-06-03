/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import classnames from "classnames";
import { CommonProps } from "@bentley/ui-core";
import "./PlayerButton.scss";

/** Player button used by buttons on timeline control
 * @internal
 */
export class PlayerButton extends React.PureComponent<any> {
  private _onClick = () => {
    // istanbul ignore else
    if (this.props.onClick)
      this.props.onClick();
  }

  public render() {
    const { icon } = this.props;
    return (
      <button data-testid={this.props.className} className={classnames("player-button", this.props.className)} onClick={this._onClick}>
        <span className={classnames("icon", icon && icon)}></span>
      </button>
    );
  }
}

/** Properties for Play/Pause button used on timeline control
 * @internal
 */
export interface PlayerButtonProps extends CommonProps {
  isPlaying: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  tooltip?: string;
}

interface PlayButtonState {
  isPlaying: boolean;
}

/** Play/Pause button used on timeline control
 * @internal
 */
export class PlayButton extends React.Component<PlayerButtonProps, PlayButtonState> {

  constructor(props: PlayerButtonProps, context?: any) {
    super(props, context);

    this.state = { isPlaying: this.props.isPlaying };
  }

  public componentWillReceiveProps(nextProps: Readonly<PlayerButtonProps>): void {
    if (nextProps.isPlaying !== this.state.isPlaying) {
      this.setState({ isPlaying: nextProps.isPlaying });
    }
  }

  private _onClick = () => {
    const _isPlaying = !this.state.isPlaying;

    this.setState({ isPlaying: _isPlaying });

    if (_isPlaying) {
      // istanbul ignore else
      if (this.props.onPlay)
        this.props.onPlay();
    } else {
      // istanbul ignore else
      if (this.props.onPause)
        this.props.onPause();
    }
  }

  public render() {
    const { tooltip } = this.props;
    const iconClassName = this.state.isPlaying ? "icon icon-media-controls-pause" : "icon icon-media-controls-play";
    return (
      <button data-testid={this.props.className} title={tooltip} className={classnames("player-button", this.props.className)} onClick={this._onClick}>
        <span className={iconClassName}></span>
      </button>
    );
  }
}
