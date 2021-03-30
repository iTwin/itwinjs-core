# Managing Summary Reports

## Using Excel to Sort Exports of Individual Packages

1. Open the appropriate `.csv` report file in Excel
2. Double-click on the line between the **A** and **B** columns to auto-resize column **A**
3. Double-click on the line between the **B** and **C** columns to auto-resize column **B**
4. Press Data-->Sort
5. In the *Sort* dialog box, enable the *My data has headers* checkbox
6. In *Sort by* option button, select *Release Tag*
7. Press *Add Level*
8. In *Then by* option button, select *API Item*
9. Press *OK*

## Creating the Full Summary API Report

1. Delete any existing `common/api/summary/summary.exports.csv`
    > The script will not overwrite any existing file
2. Set the `GENERATE_FULL_API_REPORT` environment variable to create a `summary.exports.csv` file
