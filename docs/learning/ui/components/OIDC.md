# OIDC

The [OIDC]($ui-components:OIDC) category in the `@bentley/ui-components` package includes
a component for OIDC Sign-in.

## Sample

This sample shows the SignIn component usage and specifies handler
functions for when the Sign In Button is clicked and when the
Register link is clicked.

### Imports

```tsx
import { SignIn } from "@bentley/ui-components";
import { FrontendRequestContext } from "@bentley/imodeljs-frontend";
```

### render() Method

```tsx
<SignIn onSignIn={this._onStartSignin} onRegister={this._onRegister} />
```

### Handler Functions

```tsx
  private _onStartSignin = async () => {
    this.setState((prev) => ({ user: { ...prev.user, isLoading: true } }));
    await SampleApp.oidcClient.signIn(new FrontendRequestContext());
  }

  private _onRegister = () => {
    window.open("https://www.itwinjs.org/getting-started/#developer-registration", "_blank");
  }
```

![SignIn](./images/SignIn.png "SignIn Component")

## API Reference

- [OIDC]($ui-components:OIDC)
