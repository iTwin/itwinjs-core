/** The [RenderSchedule.Script]($common) that animates the contents of the view, if any, along with the Id of the element that hosts the script.
   * @note The host element may be a [RenderTimeline]($backend) or a [DisplayStyle]($backend).
   * @deprecated in 3.x. Use [[scheduleScript]].
   */
  public get scheduleScriptReference(): RenderSchedule.ScriptReference | undefined {
    return this._scriptReference;
  }