#include "bst.h"
#include <stdlib.h>

bst_node_t *bst_insert(bst_node_t *root, uint64_t key, uint64_t value) {
    if (!root) {
        bst_node_t *node = (bst_node_t *)malloc(sizeof(bst_node_t));
        if (!node) {
            return NULL;
        }
        node->key = key;
        node->value = value;
        node->left = node->right = NULL;
        return node;
    }
    if (key < root->key) {
        root->left = bst_insert(root->left, key, value);
    } else if (key > root->key) {
        root->right = bst_insert(root->right, key, value);
    } else {
        root->value = value;
    }
    return root;
}

int bst_search(bst_node_t *root, uint64_t key, uint64_t *out_value) {
    bst_node_t *cur = root;
    while (cur) {
        if (key < cur->key) {
            cur = cur->left;
        } else if (key > cur->key) {
            cur = cur->right;
        } else {
            if (out_value) {
                *out_value = cur->value;
            }
            return 0;
        }
    }
    return -1;
}

void bst_inorder(bst_node_t *root, void (*visit)(bst_node_t *, void *), void *ctx) {
    if (!root) {
        return;
    }
    bst_inorder(root->left, visit, ctx);
    visit(root, ctx);
    bst_inorder(root->right, visit, ctx);
}

void bst_free(bst_node_t *root) {
    if (!root) {
        return;
    }
    bst_free(root->left);
    bst_free(root->right);
    free(root);
}

