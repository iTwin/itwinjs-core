# Creating a Pull Request

Developers who can't have their code reviewed by ECPresentation team
should only push changes using *pull requests*. Below are the instructions
on how to create one.

1. Create a new branch locally:
    ```batch
    git checkout -b <branch_name>
    ```

2. Work on your changes and `git commit` when you're ready. You can make
multiple commits if necessary.
Please refer to [this link](./MAKING_CHANGES.md) for rules on making changes
in ECPresentation library.

3. Push the new branch:
   ```batch
   git push origin <branch_name>
   ```

4. Go to [VSTS](https://tfs.bentley.com/tfs/ProductLine/Platform%20Technology/_git/)
and find your branch. On the right press *New pull request*.
Enter the details and press *Create*.
