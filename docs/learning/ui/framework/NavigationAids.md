# Navigation Aids

A **Navigation Aid** is a user interface control that moves the user's perspective around within a specific Content View.
There are two navigation aids provided in the `@itwin/appui-react` package:

|Navigation Aid|Description
|-----|-----
| CubeNavigationAid    | displays an interactive rotation cube for Spatial views that synchronizes with the rotation of the iModel Viewport
| DrawingNavigationAid | displays an interactive mini-map for Drawing views that synchronizes with the iModel Viewport

## Active Navigation Aid

The active Navigation Aid is determined by the active Content View. The [ContentControl]($appui-react) class contains a `navigationAidControl` property
that indicates the ID of the associated Navigation Aid. The default Navigation Aid is blank.
When a Viewport is the active content, the [ViewportContentControl]($appui-react) class determines the associated Navigation Aid based on the
`viewport.view.classFullName` property of the active Viewport.
If you are developing your own Navigation Aid for a particular content type, you will also more than likely develop your own ContentControl subclass,
and that custom ContentControl will indicate the associated Navigation Aid in the `navigationAidControl` property.

## Developing a Navigation Aid

A Navigation Aid is comprised of two parts:

1. A NavigationAidControl subclass. This custom class is registered as a Navigation Aid using `ConfigurableUiManager.registerControl`.
1. A React component that the NavigationAidControl subclass references in its `reactNode` property. This component renders the Navigation Aid and responds to user interaction.

### NavigationAidControl

The [NavigationAidControl]($appui-react) class is the base class for the first part of a Navigation Aid, the Navigation Aid control.
The `reactNode` property returns the React component part of the Navigation Aid as a `React.ReactNode`.
The `getSize` method optionally overrides the default size of "64px".

### ConfigurableUiManager.registerControl

Each NavigationAidControl subclass should be registered by calling the `ConfigurableUiManager.registerControl` method.

```ts
    ConfigurableUiManager.registerControl(SampleNavigationAidControl.navigationAidId, SampleNavigationAidControl);
```

The `ConfigurableUiManager.initialize` function calls `ConfigurableUiManager.registerControl` for the
two navigation aids provided in the `@itwin/appui-react` package:

```ts
    ConfigurableUiManager.registerControl(DrawingNavigationAidControl.navigationAidId, DrawingNavigationAidControl);
    ConfigurableUiManager.registerControl(CubeNavigationAidControl.navigationAidId, CubeNavigationAidControl);
```

### Sample Navigation Aid

A sample Navigation Aid would be comprised of the two parts.
The NavigationAidControl subclass for our sample Navigation Aid might look something like this:

```tsx
// Simple Navigation Aid
export class SampleNavigationAidControl extends NavigationAidControl {
  public static navigationAidId = "SampleNavigationAid";

  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
    this.reactNode = <SampleNavigationAid />;
  }
}
```

If the current iModelConnection or the active Viewport are supported by the Navigation Aid, it might look something like this:

```tsx
// Navigation Aid supports iModelConnection and Viewport
export class SampleNavigationAidControl extends NavigationAidControl {
  public static navigationAidId = "SampleNavigationAid";

  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    // Provide iModelConnection and Viewport to Navigation Aid
    this.reactNode = <SampleNavigationAid iModelConnection={options.imodel} viewport={options.viewport} />;
  }

  // Override default size (64px)
  public override getSize(): string | undefined { return "96px"; }
}
```

The [NavigationWidgetComposer]($appui-react) and the [NavigationAidHost]($appui-react) pass the current iModelConnection and active Viewport to the NavigationAidControl subclass when it's created.
Events such as [ViewportComponentEvents.onViewRotationChangeEvent]($imodel-components-react) and [ViewManager.onSelectedViewportChanged]($core-frontend) provide an updated Viewport.

The React component part of our Navigation Aid might look something like this:

```tsx
export interface SampleNavigationAidProps extends CommonProps {
  iModelConnection: IModelConnection;
  viewport?: Viewport;
}

export function SampleNavigationAid(props: SampleNavigationAidProps) {
  const { className, style, ...rest } = props;

  return (
    <div className={className} style={style}>
      . . .
    </div>
  );
}

```

## API Reference

- [NavigationAids in appui-react]($appui-react:NavigationAids)
- [NavigationAids in imodel-components-react]($imodel-components-react:NavigationAids)
