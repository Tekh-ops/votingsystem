#pragma once
#include <stddef.h>
#include <stdint.h>

typedef struct {
    uint64_t key;
    uint64_t value;
    uint8_t state; /* 0 empty, 1 used, 2 tombstone */
} hash_bucket_t;

typedef struct {
    hash_bucket_t *buckets;
    size_t capacity;
    size_t size;
} hash_table_t;

int hash_table_init(hash_table_t *ht, size_t capacity);
void hash_table_free(hash_table_t *ht);
int hash_table_put(hash_table_t *ht, uint64_t key, uint64_t value);
int hash_table_get(const hash_table_t *ht, uint64_t key, uint64_t *out_value);
int hash_table_delete(hash_table_t *ht, uint64_t key);

