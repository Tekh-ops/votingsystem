#include "queue.h"
#include <stdlib.h>

void queue_init(queue_t *q) {
    q->head = NULL;
    q->tail = NULL;
    q->length = 0;
}

int queue_enqueue(queue_t *q, void *data) {
    queue_node_t *node = (queue_node_t *)malloc(sizeof(queue_node_t));
    if (!node) {
        return -1;
    }
    node->data = data;
    node->next = NULL;
    if (q->tail) {
        q->tail->next = node;
    } else {
        q->head = node;
    }
    q->tail = node;
    q->length++;
    return 0;
}

void *queue_dequeue(queue_t *q) {
    if (q->head == NULL) {
        return NULL;
    }
    queue_node_t *node = q->head;
    void *data = node->data;
    q->head = node->next;
    if (q->head == NULL) {
        q->tail = NULL;
    }
    free(node);
    q->length--;
    return data;
}

int queue_empty(const queue_t *q) {
    return q->head == NULL;
}

void queue_clear(queue_t *q, void (*free_fn)(void *)) {
    queue_node_t *cur = q->head;
    while (cur) {
        queue_node_t *next = cur->next;
        if (free_fn) {
            free_fn(cur->data);
        }
        free(cur);
        cur = next;
    }
    queue_init(q);
}

