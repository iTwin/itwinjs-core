
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { IconSpecUtilities } from "@bentley/ui-abstract";
import {
  Input, Radio, Checkbox, Slider, Icon, Select,
  LabeledInput, Textarea, LabeledTextarea, LabeledSelect, IconInput, NumericInput,
  BodyText, BlockText, DisabledText, Headline, LeadingText, MutedText, SmallText, Subheading, Title,
  Button, ButtonType, ButtonSize, UnderlinedButton,
  SplitButton, ContextMenuItem,
  NewBadge, BetaBadge,
  CheckListBox, CheckListBoxItem, CheckListBoxSeparator,
  ExpandableList, ExpandableBlock,
  Spinner, SpinnerSize, LoadingSpinner, LoadingStatus, LoadingPrompt,
  Toggle, ToggleButtonType, LabeledToggle,
  SearchBox,
  Tile, FeaturedTile, MinimalTile, MinimalFeaturedTile,
  HorizontalTabs, VerticalTabs,
} from "@bentley/ui-core";

import { ComponentExampleCategory, ComponentExampleProps } from "./ComponentExamples";
import { SampleImageCheckBox } from "./SampleImageCheckBox";
import { SampleExpandableBlock } from "./SampleExpandableBlock";

import moreSvg from "@bentley/icons-generic/icons/more-circular.svg";
import moreVerticalSvg from "@bentley/icons-generic/icons/more-vertical-circular.svg";

/** Creates a Component Example */
export const createComponentExample = (title: string, description: string | undefined, content: React.ReactNode): ComponentExampleProps => {
  return { title, description, content };
};

/** Provides Component Examples */
export class ComponentExamplesProvider {
  private static get badgeSamples(): ComponentExampleCategory {
    return {
      title: "Badge",
      examples: [
        createComponentExample("BetaBadge", undefined, <BetaBadge />),
        createComponentExample("NewBadge", undefined, <NewBadge />),
      ],
    };
  }

  private static get buttonSamples(): ComponentExampleCategory {
    return {
      title: "Button",
      examples: [
        createComponentExample("Basic Button", "Primary Button", <Button>Primary Button</Button>),
        createComponentExample("Disabled Button", "Button with disabled prop", <Button disabled>Disabled Button</Button>),
        createComponentExample("Blue Button", "Button with ButtonType.Blue", <Button buttonType={ButtonType.Blue}>Blue Button</Button>),
        createComponentExample("Hollow Button", "Button with ButtonType.Hollow", <Button buttonType={ButtonType.Hollow}>Hollow Button</Button>),
        createComponentExample("Large Basic Button", "Primary Button with size={ButtonSize.Large}", <Button size={ButtonSize.Large}>Primary Button</Button>),
        createComponentExample("Large Disabled Button", "Button with disabled and size={ButtonSize.Large} props", <Button disabled size={ButtonSize.Large}>Disabled Button</Button>),
        createComponentExample("Large Blue Button", "Button with ButtonType.Blue and size={ButtonSize.Large}", <Button buttonType={ButtonType.Blue} size={ButtonSize.Large}>Blue Button</Button>),
        createComponentExample("Large Hollow Button", "Button with ButtonType.Hollow and size={ButtonSize.Large}", <Button buttonType={ButtonType.Hollow} size={ButtonSize.Large}>Hollow Button</Button>),
        createComponentExample("Underlined Button", "UnderlinedButton component", <UnderlinedButton>Underlined Button</UnderlinedButton>),
      ],
    };
  }

  private static get checkListBoxSamples(): ComponentExampleCategory {
    return {
      title: "CheckListBox",
      examples: [
        createComponentExample("CheckListBox", undefined,
          <CheckListBox>
            <CheckListBoxItem label="Item 1" />
            <CheckListBoxItem label="Item 2" />
          </CheckListBox>),
        createComponentExample("CheckListBox with separator", undefined,
          <CheckListBox>
            <CheckListBoxItem label="Item 1" />
            <CheckListBoxItem label="Item 2" />
            <CheckListBoxSeparator />
            <CheckListBoxItem label="Item 3" />
            <CheckListBoxItem label="Item 4" />
          </CheckListBox>),
      ],
    };
  }

  private static get expandableListBlockSamples(): ComponentExampleCategory {
    return {
      title: "ExpandableList/Block",
      examples: [
        createComponentExample("ExpandableList", "ExpandableList with one ExpandableBlock",
          <ExpandableList className="uicore-full-width">
            <SampleExpandableBlock title="Test" isExpanded={true} onClick={() => { }}>
              Hello
            </SampleExpandableBlock>
          </ExpandableList >),
        createComponentExample("ExpandableList w/ singleExpandOnly", "ExpandableList with singleExpandOnly prop",
          <ExpandableList className="uicore-full-width" singleExpandOnly={true} defaultActiveBlock={0}>
            <ExpandableBlock title="Test0" isExpanded={false} onClick={() => { }}>
              Hello0
            </ExpandableBlock>
            <ExpandableBlock title="Test1" isExpanded={false} onClick={() => { }}>
              Hello1
            </ExpandableBlock>
          </ExpandableList>),
      ],
    };
  }

  private static get inputsSamples(): ComponentExampleCategory {
    return {
      title: "Inputs",
      examples: [
        createComponentExample("Basic Input", "Input with placeholder", <Input placeholder="Basic Input" />),
        createComponentExample("Disabled Input", "Input with disabled prop", <Input placeholder="Disabled Input" disabled />),

        createComponentExample("Check Box", "Basic Check Box", <Checkbox label="Basic Check Box" />),
        createComponentExample("Disabled Check Box", "Check Box with disabled prop", <Checkbox label="Disabled Check Box" disabled />),

        createComponentExample("Radio Button", "Basic Radio Button", <Radio label="Basic Radio Button" name="demo1" />),
        createComponentExample("Disabled Radio Button", "Radio Button with disabled prop", <Radio label="Disabled Radio Button" name="demo1" disabled />),

        createComponentExample("Basic Select", "Basic Select component", <Select options={["Option 1", "Option 2", "Option 3", "Option 4"]} />),
        createComponentExample("Disabled Select", "Select with disabled prop", <Select options={["Option 1", "Option 2", "Option 3", "Option 4"]} disabled />),

        createComponentExample("Basic Textarea", "Textarea with placeholder", <Textarea placeholder="Basic Textarea" />),
        createComponentExample("Disabled Textarea", "Textarea with disabled prop", <Textarea placeholder="Disabled Textarea" disabled />),

        createComponentExample("Numeric Input", "Numeric Input component", <NumericInput placeholder="Icon Input" min={1} max={100} className="uicore-full-width" />),
        createComponentExample("Icon Input", "Icon Input component", <IconInput placeholder="Icon Input" icon={<Icon iconSpec="icon-placeholder" />} containerClassName="uicore-full-width" />),
        createComponentExample("Labeled Input", "Labeled Input component", <LabeledInput label="Labeled Input" placeholder="Labeled Input" className="uicore-full-width" />),
        createComponentExample("Labeled Textarea", "Labeled Textarea component", <LabeledTextarea label="Labeled Textarea" placeholder="Labeled Textarea" className="uicore-full-width" />),
        createComponentExample("Labeled Select", "Labeled Select component", <LabeledSelect label="Labeled Select" options={["Option 1", "Option 2", "Option 3", "Option 4"]} />),

        createComponentExample("Image Checkbox", "ImageCheckbox with WebFonts", <SampleImageCheckBox imageOn="icon-more-circular" imageOff="icon-more-vertical-circular" />),
        createComponentExample("Image Checkbox", "ImageCheckbox with SVG fonts", <SampleImageCheckBox imageOn={IconSpecUtilities.createSvgIconSpec(moreSvg)} imageOff={IconSpecUtilities.createSvgIconSpec(moreVerticalSvg)} />),
      ],
    };
  }

  private static get loadingSamples(): ComponentExampleCategory {
    return {
      title: "Loading",
      examples: [
        createComponentExample("Small Spinner", undefined, <Spinner size={SpinnerSize.Small} />),
        createComponentExample("Medium Spinner", undefined, <Spinner size={SpinnerSize.Medium} />),
        createComponentExample("Large Spinner", undefined, <Spinner size={SpinnerSize.Large} />),
        createComponentExample("XLarge Spinner", undefined, <Spinner size={SpinnerSize.XLarge} />),
        createComponentExample("Small LoadingSpinner", undefined, <LoadingSpinner size={SpinnerSize.Small} message="This is a Small LoadingSpinner" />),
        createComponentExample("Medium LoadingSpinner", undefined, <LoadingSpinner size={SpinnerSize.Medium} message="This is a Medium LoadingSpinner" />),
        createComponentExample("Large LoadingSpinner", undefined, <LoadingSpinner size={SpinnerSize.Large} message="This is a Large LoadingSpinner" />),
        createComponentExample("XLarge LoadingSpinner", undefined, <LoadingSpinner size={SpinnerSize.XLarge} message="This is a XLarge LoadingSpinner" />),
        createComponentExample("LoadingStatus", undefined, <LoadingStatus message="Loading status..." percent={50} />),
        createComponentExample("Basic LoadingPrompt", undefined, <LoadingPrompt title="Title" />),
        createComponentExample("LoadingPrompt with message", undefined, <LoadingPrompt title="Title" message="This is the message" />),
        createComponentExample("Deterministic LoadingPrompt", undefined, <LoadingPrompt title="Title" message="This is the message" isDeterministic={true} />),
        createComponentExample("Deterministic LoadingPrompt with percent", undefined,
          <LoadingPrompt title="Title" message="This is the message" isDeterministic={true} percent={50} />),
        createComponentExample("Deterministic LoadingPrompt with cancel", undefined,
          <LoadingPrompt title="Title" message="This is the message" isDeterministic={true} percent={50} showCancel={true} />),
        createComponentExample("Deterministic LoadingPrompt with status", undefined,
          <LoadingPrompt title="Title" message="This is the message" isDeterministic={true} showStatus={true} percent={50} status="updating..." />),
      ],
    };
  }

  private static get searchBoxSample(): ComponentExampleCategory {
    return {
      title: "SearchBox",
      examples: [
        createComponentExample("SearchBox", undefined, <SearchBox placeholder="Search" onValueChanged={(_value: string) => { }} />),
      ],
    };
  }

  private static get sliderSamples(): ComponentExampleCategory {
    return {
      title: "Slider",
      examples: [
        createComponentExample("Slider", "Basic Slider",
          <Slider min={0} max={100} values={[50]} step={1} showTooltip />),
        createComponentExample("Slider w/ min/max", "Slider with showMinMax prop",
          <Slider min={0} max={100} values={[50]} step={1} showTooltip showMinMax />),
        createComponentExample("Slider w/ min/max images", "Slider with minImage and maxImage props",
          <Slider min={0} max={100} values={[50]} step={1} showTooltip showMinMax
            minImage={<Icon iconSpec="icon-placeholder" />} maxImage={<Icon iconSpec="icon-placeholder" />} />),
        createComponentExample("Slider w/ tick marks", "Slider with showTicks and getTickCount props",
          <Slider min={0} max={100} values={[50]} step={1} showTooltip showMinMax
            showTicks getTickCount={() => 10} />),
        createComponentExample("Slider w/ multiple values", "Slider with array of values",
          <Slider min={0} max={100} values={[30, 70]} step={5} mode={2} showTooltip showMinMax
            showTicks getTickCount={() => 10} />),
        createComponentExample("Slider w/ tick labels", "Slider with showTickLabels prop",
          <Slider min={0} max={100} values={[50]} step={1} showTooltip showMinMax showTickLabels
            showTicks getTickCount={() => 10} />),
      ],
    };
  }

  private static get splitButtonSamples(): ComponentExampleCategory {
    return {
      title: "SplitButton",
      examples: [
        createComponentExample("Basic SplitButton", "Basic SplitButton",
          <SplitButton label="Split Button">
            {this.splitButtonMenuItems.map((node) => node)}
          </SplitButton>),
        createComponentExample("SplitButton with border", "SplitButton with drawBorder prop",
          <SplitButton label="Split Button" drawBorder>
            {this.splitButtonMenuItems.map((node) => node)}
          </SplitButton>),
      ],
    };
  }

  private static get splitButtonMenuItems(): React.ReactNode[] {
    return [
      <ContextMenuItem key="item1" icon="icon-placeholder">Item 1</ContextMenuItem>,
      <ContextMenuItem key="item2" icon="icon-placeholder">Item 2</ContextMenuItem>,
      <ContextMenuItem key="item3" icon="icon-placeholder">Item 3</ContextMenuItem>,
    ];
  }

  private static get tabsSamples(): ComponentExampleCategory {
    return {
      title: "Tabs",
      examples: [
        createComponentExample("Horizontal Tabs", undefined, <HorizontalTabs labels={["Tab 1", "Tab 2", "Tab 3"]} activeIndex={0} />),
        createComponentExample("Green Horizontal Tabs", "with green prop", <HorizontalTabs labels={["Tab 1", "Tab 2", "Tab 3"]} activeIndex={0} green />),
        createComponentExample("Vertical Tabs", undefined, <VerticalTabs labels={["Tab 1", "Tab 2", "Tab 3"]} activeIndex={0} />),
        createComponentExample("Green Vertical Tabs", "with green prop", <VerticalTabs labels={["Tab 1", "Tab 2", "Tab 3"]} activeIndex={0} green />),
      ],
    };
  }

  private static get textSamples(): ComponentExampleCategory {
    return {
      title: "Text",
      examples: [
        createComponentExample("BodyText", undefined, <BodyText>This is Body Text</BodyText>),
        createComponentExample("BlockText", undefined, <BlockText>This is Block Text</BlockText>),
        createComponentExample("DisabledText", undefined, <DisabledText>This is Disabled Text</DisabledText>),
        createComponentExample("Headline", undefined, <Headline>This is Headline Text</Headline>),
        createComponentExample("LeadingText", undefined, <LeadingText>This is Leading Text</LeadingText>),
        createComponentExample("MutedText", undefined, <MutedText>This is Muted Text</MutedText>),
        createComponentExample("SmallText", undefined, <SmallText>This is Small Text</SmallText>),
        createComponentExample("Subheading", undefined, <Subheading>This is Subheading Text</Subheading>),
        createComponentExample("Title", undefined, <Title>This is Title Text</Title>),
      ],
    };
  }

  private static get tileSamples(): ComponentExampleCategory {
    return {
      title: "Tiles",
      examples: [
        createComponentExample("Normal Tile", undefined,
          <Tile title="Normal Tile" icon="icon-placeholder">
            <a>Link 1</a>
            <a>Link 2</a>
          </Tile>),
        createComponentExample("Featured Tile", undefined,
          <FeaturedTile title="Featured Tile" icon="icon-placeholder">
            <a>Link 1</a>
            <a>Link 2</a>
          </FeaturedTile>),
        createComponentExample("Featured Tile", undefined, <MinimalTile title="Minimal Tile" icon="icon-placeholder" />),
        createComponentExample("Featured Minimal Tile", undefined, <MinimalFeaturedTile title="Minimal Featured Tile" icon="icon-placeholder" />),
        createComponentExample("Tile stepNum={0}", undefined, <MinimalFeaturedTile stepNum={0} title="Tile stepNum={0}" icon="icon-placeholder" />),
        createComponentExample("Tile stepNum={6}", undefined, <MinimalFeaturedTile stepNum={6} title="Tile stepNum={6}" icon="icon-placeholder" />),
        createComponentExample("Tile stepNum={9}", undefined, <MinimalFeaturedTile stepNum={9} title="Tile stepNum={9}" icon="icon-placeholder" />),
        createComponentExample("Tile stepNum={15}", undefined, <MinimalFeaturedTile stepNum={15} title="Tile stepNum={15}" icon="icon-placeholder" />),
      ],
    };
  }

  private static get toggleSamples(): ComponentExampleCategory {
    return {
      title: "Toggle",
      examples: [
        createComponentExample("Basic Toggle", undefined, <Toggle isOn={true} />),
        createComponentExample("Primary Toggle", "Toggle with buttonType={ToggleButtonType.Primary}", <Toggle isOn={true} buttonType={ToggleButtonType.Primary} />),
        createComponentExample("Large Toggle", "Toggle with large={true}", <Toggle isOn={true} large={true} />),
        createComponentExample("Square Toggle", "Toggle with rounded={false}", <Toggle isOn={true} rounded={false} />),
        createComponentExample("Toggle with Checkmark", "Toggle with showCheckmark prop", <Toggle isOn={true} showCheckmark={true} />),
        createComponentExample("LabeledToggle", undefined, <LabeledToggle isOn={true} label="Toggle label" />),
      ],
    };
  }

  public static get categories(): ComponentExampleCategory[] {
    return [
      ComponentExamplesProvider.badgeSamples,
      ComponentExamplesProvider.buttonSamples,
      ComponentExamplesProvider.checkListBoxSamples,
      ComponentExamplesProvider.expandableListBlockSamples,
      ComponentExamplesProvider.inputsSamples,
      ComponentExamplesProvider.loadingSamples,
      ComponentExamplesProvider.searchBoxSample,
      ComponentExamplesProvider.sliderSamples,
      ComponentExamplesProvider.splitButtonSamples,
      ComponentExamplesProvider.tabsSamples,
      ComponentExamplesProvider.textSamples,
      ComponentExamplesProvider.tileSamples,
      ComponentExamplesProvider.toggleSamples,
    ];
  }
}
