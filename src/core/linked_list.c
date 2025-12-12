#include "linked_list.h"
#include <stdlib.h>

void list_init(linked_list_t *list) {
    list->head = NULL;
    list->tail = NULL;
    list->length = 0;
}

int list_push_back(linked_list_t *list, void *data) {
    list_node_t *node = (list_node_t *)malloc(sizeof(list_node_t));
    if (!node) {
        return -1;
    }
    node->data = data;
    node->next = NULL;
    if (list->tail) {
        list->tail->next = node;
    } else {
        list->head = node;
    }
    list->tail = node;
    list->length++;
    return 0;
}

int list_push_front(linked_list_t *list, void *data) {
    list_node_t *node = (list_node_t *)malloc(sizeof(list_node_t));
    if (!node) {
        return -1;
    }
    node->data = data;
    node->next = list->head;
    list->head = node;
    if (list->tail == NULL) {
        list->tail = node;
    }
    list->length++;
    return 0;
}

void *list_pop_front(linked_list_t *list) {
    if (list->head == NULL) {
        return NULL;
    }
    list_node_t *node = list->head;
    void *data = node->data;
    list->head = node->next;
    if (list->head == NULL) {
        list->tail = NULL;
    }
    free(node);
    list->length--;
    return data;
}

void list_clear(linked_list_t *list, void (*free_fn)(void *)) {
    list_node_t *cur = list->head;
    while (cur) {
        list_node_t *next = cur->next;
        if (free_fn) {
            free_fn(cur->data);
        }
        free(cur);
        cur = next;
    }
    list_init(list);
}

