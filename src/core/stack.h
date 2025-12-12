#pragma once
#include <stddef.h>

typedef struct {
    void **data;
    size_t size;
    size_t capacity;
} ds_stack_t;

int stack_init(ds_stack_t *st, size_t initial_capacity);
void stack_free(ds_stack_t *st);
int stack_push(ds_stack_t *st, void *item);
void *stack_pop(ds_stack_t *st);
void *stack_peek(const ds_stack_t *st);
int stack_empty(const ds_stack_t *st);

