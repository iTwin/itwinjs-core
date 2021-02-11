# Text

The [Text]($ui-core:Text) category in the `@bentley/ui-core` package includes
CSS classes and React components for working with styled text.

|Component|Description
|-----|-----
|[StyledText]($ui-core)|base component for other text components that pass a main CSS class name
|[BodyText]($ui-core)|uses the `uicore-text-body` CSS class, which has a 14px font-size
|[BlockText]($ui-core)|uses the `uicore-text-block` CSS class, which has a 14px font-size and block spacing
|[DisabledText]($ui-core)|uses the `uicore-text-disabled` CSS class, which has the `$buic-foreground-disabled` color
|[Headline]($ui-core)|uses the `uicore-text-headline` CSS class, which has a 32px font-size
|[LeadingText]($ui-core)|uses the `uicore-text-leading` CSS class, which has a 16px font-size
|[MutedText]($ui-core)|uses the `uicore-text-muted` CSS class, which has the `$buic-foreground-muted` color
|[SmallText]($ui-core)|uses the `uicore-text-small` CSS class, which has a 12px font-size
|[Subheading]($ui-core)|uses the `uicore-text-subheading` CSS class, which has a 18px font-size
|[Title]($ui-core)|uses the `uicore-text-title` CSS class, which has a 24px font-size

## Examples

```tsx
<BodyText>This is Body Text</BodyText>
<BlockText>This is Block Text</BlockText>
<DisabledText>This is Disabled Text</DisabledText>
<Headline>This is Headline Text</Headline>
<LeadingText>This is Leading Text</LeadingText>
<MutedText>This is Muted Text</MutedText>
<SmallText>This is Small Text</SmallText>
<Subheading>This is Subheading Text</Subheading>
<Title>This is Title Text</Title>
```

![text](./images/Text.png "Text Components")

### Dark Theme

![text dark](./images/TextDark.png "Text Components in Dark Theme")

## API Reference

- [Text]($ui-core:Text)
