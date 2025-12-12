#pragma once
#include <stdint.h>

typedef struct bst_node {
    uint64_t key;
    uint64_t value;
    struct bst_node *left;
    struct bst_node *right;
} bst_node_t;

bst_node_t *bst_insert(bst_node_t *root, uint64_t key, uint64_t value);
int bst_search(bst_node_t *root, uint64_t key, uint64_t *out_value);
void bst_inorder(bst_node_t *root, void (*visit)(bst_node_t *, void *), void *ctx);
void bst_free(bst_node_t *root);

