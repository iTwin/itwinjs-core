# Pushing Changes

It's recommended to use pull requests, because:
- The changes on pull requests branch get built by the CI job
which verifies they don't break anything.
- The changes get reviewed by someone.

**Note:** before pushing (even into a pull request branch) it's recommended
to run the `scripts/pre-publish.bat` script - it runs the same commands as
our CI job and helps to make sure you don't forget to build / lint /
test / etc.

## Creating a Pull Request

1. Create a new branch locally:
    ```batch
    git checkout -b <branch_name>
    ```

2. Work on your changes and `git commit` when you're ready. You can make
multiple commits if necessary. Please refer to [this link](./Commiting.md)
for rules on making changes in iModelJs Presentation library.

3. Push the new branch:
   ```batch
   git push origin <branch_name>
   ```

4. Go to [VSTS](https://tfs.bentley.com/tfs/ProductLine/Platform%20Technology/_git/)
and find your branch. On the right press *New pull request*.
Enter the details and press *Create*.
