#pragma once
#include <stddef.h>
#include <stdint.h>

typedef struct {
    size_t leaf_count;
    size_t tree_size;
    uint64_t *tree;
} selection_tree_t;

int selection_tree_build(selection_tree_t *t, const uint64_t *leaves, size_t n);
void selection_tree_free(selection_tree_t *t);
int selection_tree_update(selection_tree_t *t, size_t index, uint64_t value);
size_t selection_tree_winner(const selection_tree_t *t);

