#include "selection_tree.h"
#include <stdlib.h>

static size_t next_pow2(size_t n) {
    size_t p = 1;
    while (p < n) {
        p <<= 1;
    }
    return p;
}

int selection_tree_build(selection_tree_t *t, const uint64_t *leaves, size_t n) {
    t->leaf_count = n;
    size_t base = next_pow2(n);
    t->tree_size = base * 2;
    t->tree = (uint64_t *)calloc(t->tree_size, sizeof(uint64_t));
    if (!t->tree) {
        return -1;
    }
    for (size_t i = 0; i < n; i++) {
        t->tree[base + i] = leaves[i];
    }
    for (size_t i = base - 1; i > 0; i--) {
        uint64_t left = t->tree[i << 1];
        uint64_t right = t->tree[(i << 1) | 1];
        t->tree[i] = left >= right ? left : right;
    }
    return 0;
}

void selection_tree_free(selection_tree_t *t) {
    free(t->tree);
    t->tree = NULL;
    t->leaf_count = 0;
    t->tree_size = 0;
}

int selection_tree_update(selection_tree_t *t, size_t index, uint64_t value) {
    if (index >= t->leaf_count) {
        return -1;
    }
    size_t base = t->tree_size / 2;
    size_t pos = base + index;
    t->tree[pos] = value;
    while (pos > 1) {
        pos >>= 1;
        uint64_t left = t->tree[pos << 1];
        uint64_t right = t->tree[(pos << 1) | 1];
        t->tree[pos] = left >= right ? left : right;
    }
    return 0;
}

size_t selection_tree_winner(const selection_tree_t *t) {
    size_t base = t->tree_size / 2;
    uint64_t best = t->tree[1];
    size_t winner = 0;
    for (size_t i = 0; i < t->leaf_count; i++) {
        uint64_t val = t->tree[base + i];
        if (val == best) {
            winner = i;
            break;
        }
    }
    return winner;
}

