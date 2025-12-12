#include "stack.h"
#include <stdlib.h>

int stack_init(ds_stack_t *st, size_t initial_capacity) {
    st->size = 0;
    st->capacity = initial_capacity ? initial_capacity : 4;
    st->data = (void **)malloc(st->capacity * sizeof(void *));
    return st->data ? 0 : -1;
}

void stack_free(ds_stack_t *st) {
    free(st->data);
    st->data = NULL;
    st->size = 0;
    st->capacity = 0;
}

static int stack_grow(ds_stack_t *st) {
    size_t new_cap = st->capacity * 2;
    void **new_data = (void **)realloc(st->data, new_cap * sizeof(void *));
    if (!new_data) {
        return -1;
    }
    st->data = new_data;
    st->capacity = new_cap;
    return 0;
}

int stack_push(ds_stack_t *st, void *item) {
    if (st->size == st->capacity && stack_grow(st) != 0) {
        return -1;
    }
    st->data[st->size++] = item;
    return 0;
}

void *stack_pop(ds_stack_t *st) {
    if (st->size == 0) {
        return NULL;
    }
    return st->data[--st->size];
}

void *stack_peek(const ds_stack_t *st) {
    if (st->size == 0) {
        return NULL;
    }
    return st->data[st->size - 1];
}

int stack_empty(const ds_stack_t *st) {
    return st->size == 0;
}

