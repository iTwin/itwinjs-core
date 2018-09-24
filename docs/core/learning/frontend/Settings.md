# Saving and Retrieving Settings in iModelJs

Applications frequently need to persist settings across sessions. Examples include user preferences; tool settings; recently accessed models, views, or projects; user interface state; etc. Some such settings are application specific, some are Project specific, and some are iModel specific. Such settings are often specific to a particular user, but in some cases defaults settings are established that are available to all users.

In theory, settings that are iModel-specific could be stored in the iModel itself, but in practice that is not optimal, because the transaction model for design data does not fit well with settings data, and it is undesirable to have to commit a new version of an iModel every time a setting is saved. Therefore, the Settings service described here should be used for those settings.

## The SettingsAdmin class

iModelJs provides the SettingsAdmin object, accessed through IModelApp.settings, for managing settings. The default implementation of the SettingsAdmin interface stores all settings to a Bentley CONNECT cloud service, but other implementations are possible. The default implementation treats Settings like sensitive data, which can be accessed only by logged-in users with the appropriate permissions.

The methods on SettingsAdmin allow saving and retrieving setting that are either user-specific or for all users. Saving a setting that is not user-specific requires administrator privileges, and is stored as specific to the organization of the user. Any user of that belongs to that organization can retrieve the setting.

Non-user-specific settings can be:

  * Specific to an application (for example, default application preferences)
  * Specific to an application and Project (for example, the default iModel for the project when the application is opened)
  * Specific to an application and iModel (for example, the default views for the iModel when the application is opened)
  * Specific to a Project (for example, a message of the day for all users of that Project)
  * Specific to an iModel (for example, default basic preferences relevant to all applications)

User-specific settings can be:

  * Specific to an application (for example, the user's particular application preferences)
  * Specific to an application and Project (for example, the user's most recently opened iModel when using the application)
  * Specific to an application and iModel (for example, the user's application-specific session data)
  * Specific to a Project (for example, the user's list of favorite iModels in that project)
  * Specific to an iModel (for example, the user's list of favorite views in that iModel)
  * Specific only to the user (for example, a list of favorite applications)

Settings are identified by a namespace, which is up to the program, but should be chosen to be unique, and a name, which need only be unique within the namespace.

All settings are passed as object instances to the SettingsAdmin methods that save settings, and persisted as JSON strings representing that object. The return value from the SettingsAdmin methods is a SettingsResult, which contains a status property, an error message which might be populated with explanatory information if the status indicates an error, and the retrieved setting object for the settings retrieval methods.
