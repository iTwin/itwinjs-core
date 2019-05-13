# Backstage

The **Backstage** is a menu used to open frontstages and launch tasks and commands.
It can also open full-screen overlays presenting application settings and data management to the user.
These overlays are an implementation of a modal frontstage.
The backstage is opened by clicking or pressing the App button and displays along the left edge of the window.

## Defining a Backstage



## Specifying a Backstage to ConfigurableUiContent

```TSX
import AppBackstage from "../app-ui/AppBackstage";

// . . .

/** Renders a viewport, a tree, a property grid and a table */
class IModelComponents extends React.PureComponent {
  public render() {
    const configurableUiContentProps = {
      appBackstage: <AppBackstage />,
    };
    return (
      <ConfigurableUiContent {...configurableUiContentProps} />
    );
  }
}
```

## API Reference

* [Backstage]($framework:Backstage)
