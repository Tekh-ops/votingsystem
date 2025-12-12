#pragma once
#include <stddef.h>

typedef struct list_node {
    void *data;
    struct list_node *next;
} list_node_t;

typedef struct {
    list_node_t *head;
    list_node_t *tail;
    size_t length;
} linked_list_t;

void list_init(linked_list_t *list);
int list_push_back(linked_list_t *list, void *data);
int list_push_front(linked_list_t *list, void *data);
void *list_pop_front(linked_list_t *list);
void list_clear(linked_list_t *list, void (*free_fn)(void *));

