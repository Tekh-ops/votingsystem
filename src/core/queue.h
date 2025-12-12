#pragma once
#include <stddef.h>

typedef struct queue_node {
    void *data;
    struct queue_node *next;
} queue_node_t;

typedef struct {
    queue_node_t *head;
    queue_node_t *tail;
    size_t length;
} queue_t;

void queue_init(queue_t *q);
int queue_enqueue(queue_t *q, void *data);
void *queue_dequeue(queue_t *q);
int queue_empty(const queue_t *q);
void queue_clear(queue_t *q, void (*free_fn)(void *));

