/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./ComponentExamples.scss";
import * as React from "react";
import { CommonProps, Toggle, VerticalTabs } from "@bentley/ui-core";
import { ColorTheme, ModalFrontstageInfo, UiFramework } from "@bentley/ui-framework";
import { ComponentExamplesProvider } from "./ComponentExamplesProvider";

export interface ComponentExampleCategory {
  title: string;
  examples: ComponentExampleProps[];
}

/** Modal frontstage displaying component examples.
 */
export class ComponentExamplesModalFrontstage implements ModalFrontstageInfo {
  public title: string = UiFramework.i18n.translate("SampleApp:componentExamplesStage.examples");
  public categories: ComponentExampleCategory[] = ComponentExamplesProvider.categories;
  public get content(): React.ReactNode { return (<ComponentExamplesPage categories={this.categories} />); }
}

interface ComponentExamplesPageProps {
  categories: ComponentExampleCategory[];
}

/** ComponentExamplesPage displaying the component examples.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
const ComponentExamplesPage: React.FC<ComponentExamplesPageProps> = (props: ComponentExamplesPageProps) => {
  const _themeTitle: string = UiFramework.i18n.translate("SampleApp:componentExamplesStage.themeTitle");
  const _themeDescription: string = UiFramework.i18n.translate("SampleApp:componentExamplesStage.themeDescription");

  const [activeIndex, setActiveIndex] = React.useState(0);

  const _onThemeChange = () => {
    const theme = _isLightTheme() ? ColorTheme.Dark : ColorTheme.Light;
    UiFramework.setColorTheme(theme);
  };

  const _isLightTheme = (): boolean => {
    return (UiFramework.getColorTheme() === ColorTheme.Light);
  };

  const isLightTheme = _isLightTheme();
  const darkLabel = UiFramework.i18n.translate("SampleApp:settingsStage.dark");
  const lightLabel = UiFramework.i18n.translate("SampleApp:settingsStage.light");

  const _handleActivateTab = (index: number) => {
    setActiveIndex(index);
  };

  return (
    <div className="component-examples">
      <div className="component-examples-categories">
        <VerticalTabs
          labels={props.categories.map((category: ComponentExampleCategory) => category.title)}
          activeIndex={activeIndex} onActivateTab={_handleActivateTab} />
      </div>
      <div className="component-examples-items">
        <ComponentExample title={_themeTitle} description={_themeDescription}
          content={
            <>
              {darkLabel}
              &nbsp;
              <Toggle isOn={isLightTheme} showCheckmark={false} onChange={_onThemeChange} />
              &nbsp;
              {lightLabel}
            </>
          }
        />
        <hr className="component-examples-items-separator" />
        {props.categories[activeIndex].examples.map((exampleProps: ComponentExampleProps, index: number) => {
          const { title, description, content, ...otherProps } = exampleProps;
          return (
            <ComponentExample key={index.toString()} title={title} description={description} content={content} {...otherProps} />
          );
        })}
      </div>
    </div>
  );
};

/** Properties for the Component Example component */
export interface ComponentExampleProps extends CommonProps {
  title: string;
  description?: string;
  content: React.ReactNode;
}

/** Component Example component */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const ComponentExample: React.FC<ComponentExampleProps> = (props: ComponentExampleProps) => {
  const { title, description, content } = props;
  return (
    <div className="component-examples-item">
      <div className="panel left-panel">
        <span className="title">{title}</span>
        {description && <span className="description">{description}</span>}
      </div>
      <div className="panel right-panel">
        {content}
      </div>
    </div>
  );
};
