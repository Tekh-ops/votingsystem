#include "tally.h"

int tally_winner(const uint64_t *counts, size_t n, size_t *out_index) {
    selection_tree_t tree;
    if (selection_tree_build(&tree, counts, n) != 0) {
        return -1;
    }
    size_t win = selection_tree_winner(&tree);
    selection_tree_free(&tree);
    if (out_index) {
        *out_index = win;
    }
    return 0;
}

