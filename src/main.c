#include "cli/cli.h"
#include <stdio.h>

int main(int argc, char **argv) {
    if (cli_run(argc, argv) != 0) {
        fprintf(stderr, "Command failed\n");
        return 1;
    }
    return 0;
}

