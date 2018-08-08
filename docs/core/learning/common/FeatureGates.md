# Feature Gates

A "feature gate" is a parameter that an app or service can check to enable or disable features at runtime. A gate can be any type, e.g. boolean, string, number or even object. Generally they are established at startup, but may be changed at runtime based, for example, on user credentials or server-based priorities, etc.

A service typically gets its feature gates from its deployment parameters.
*Example:*

```ts
[[include:FeatureGates.defineFeatureGates]]
```

An example of the feature gate portion of a configuration .json file that is deployed with a service might be:

``` json
{
  "features": {
    "imodel": {
      "readwrite": "${ROBOT-WORLD-FEATURE-READWRITE}"
    },
    "experimental": {
      "methods": "${ROBOT-WORLD-FEATURE-EXPERIMENTAL-METHODS}"
    }
  }
}
```

Note how the values of the configuration properties are defined by placeholders, which are delimited by ${}. Such placeholders will be replaced by EnvMacroSubst with the values of like-named environment variables. That allows a deployment mechanism to supply the values for configuration parameters and inject them into the service.

A service then checks its feature gates in its methods.
*Example:*

```ts
[[include:FeatureGates.checkFeatureGates]]
```
