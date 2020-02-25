/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { Toggle, VerticalTabs } from "@bentley/ui-core";
import { UiFramework, ColorTheme, ModalFrontstageInfo } from "@bentley/ui-framework";
import "./ComponentExamples.scss";
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
// tslint:disable-next-line:variable-name
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
  const _theme: string = UiFramework.i18n.translate((isLightTheme) ? "SampleApp:componentExamplesStage.light" : "SampleApp:componentExamplesStage.dark");

  const _handleClickLabel = (index: number) => {
    setActiveIndex(index);
  };

  return (
    <div className="component-examples">
      <div className="component-examples-categories">
        <VerticalTabs
          labels={props.categories.map((category: ComponentExampleCategory) => category.title)}
          activeIndex={activeIndex} onClickLabel={_handleClickLabel} />
      </div>
      <div className="component-examples-items">
        <ComponentExample title={_themeTitle} description={_themeDescription}
          content={
            <>
              <Toggle isOn={isLightTheme} showCheckmark={false} onChange={_onThemeChange} />
              &nbsp;&nbsp;
              {_theme}
            </>
          }
        />
        <hr className="component-examples-items-separator" />
        {props.categories[activeIndex].examples.map((exampleProps: ComponentExampleProps, index: number) => {
          return (
            <ComponentExample key={index.toString()} title={exampleProps.title} description={exampleProps.description} content={exampleProps.content} />
          );
        })}
      </div>
    </div>
  );
};

/** Properties for the Component Example component */
export interface ComponentExampleProps {
  title: string;
  description?: string;
  content: React.ReactNode;
}

/** Component Example component */
// tslint:disable-next-line:variable-name
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
