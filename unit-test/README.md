Unit testing directory with bats-core

* How it was initiated
  * git submodule add <https://github.com/bats-core/bats-core.git> unit-test/libs/bats
  * echo '#!/bin/bash' > unit-test/test_all.sh
  * echo 'cd "$(dirname "$0")" || true' >> unit-test/test_all.sh
  * echo 'libs/bats/bin/bats $(find *.bats -maxdepth 0 | sort)' >> unit-test/test_all.sh
  * chmod +x unit-test/test_all.sh

* How to write a unit test
  * write a program you want to test in your local ./unit-test/
  * write a bat file to create a unit test (sample ./unit-test/validate-bump.bats)
    For documentation - (<https://bats-core.readthedocs.io/en/stable/>)
  * execute the command `unit-test/test_all.sh` to test
