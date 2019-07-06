---
ignore: true
---
# NextVersion

## Updates to Authorization

* [OidcBrowserClient]($frontend) now uses local storage instead of session storage to store access tokens. The state of the authorization would therefore now be preserved if the browser was closed and reopened.<br/>
**Note**: For this to work, it's required that the user not have modified the browser settings to clear local storage on exit.

* [OidcAgentClient]($clients-backend) is now available as beta (it was marked internal earlier). Using the client requires an Agent registration and potential changes to the Connect Project settings - see more documentation in [OidcAgentClient]($clients-backend).
