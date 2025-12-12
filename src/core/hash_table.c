#include "hash_table.h"
#include <stdlib.h>

static uint64_t mix64(uint64_t x) {
    x ^= x >> 33;
    x *= 0xff51afd7ed558ccdULL;
    x ^= x >> 33;
    x *= 0xc4ceb9fe1a85ec53ULL;
    x ^= x >> 33;
    return x;
}

static size_t clamp_capacity(size_t cap) {
    size_t n = 1;
    while (n < cap) {
        n <<= 1;
    }
    return n;
}

int hash_table_init(hash_table_t *ht, size_t capacity) {
    ht->capacity = clamp_capacity(capacity ? capacity : 8);
    ht->size = 0;
    ht->buckets = (hash_bucket_t *)calloc(ht->capacity, sizeof(hash_bucket_t));
    return ht->buckets ? 0 : -1;
}

void hash_table_free(hash_table_t *ht) {
    free(ht->buckets);
    ht->buckets = NULL;
    ht->capacity = 0;
    ht->size = 0;
}

static int maybe_grow(hash_table_t *ht);

int hash_table_put(hash_table_t *ht, uint64_t key, uint64_t value) {
    if (maybe_grow(ht) != 0) {
        return -1;
    }
    size_t mask = ht->capacity - 1;
    size_t idx = mix64(key) & mask;
    size_t first_tomb = (size_t)-1;
    for (;;) {
        hash_bucket_t *b = &ht->buckets[idx];
        if (b->state == 0) {
            hash_bucket_t *dest = (first_tomb != (size_t)-1) ? &ht->buckets[first_tomb] : b;
            dest->key = key;
            dest->value = value;
            dest->state = 1;
            ht->size++;
            return 0;
        }
        if (b->state == 2 && first_tomb == (size_t)-1) {
            first_tomb = idx;
        } else if (b->state == 1 && b->key == key) {
            b->value = value;
            return 0;
        }
        idx = (idx + 1) & mask;
    }
}

int hash_table_get(const hash_table_t *ht, uint64_t key, uint64_t *out_value) {
    size_t mask = ht->capacity - 1;
    size_t idx = mix64(key) & mask;
    for (;;) {
        const hash_bucket_t *b = &ht->buckets[idx];
        if (b->state == 0) {
            return -1;
        }
        if (b->state == 1 && b->key == key) {
            if (out_value) {
                *out_value = b->value;
            }
            return 0;
        }
        idx = (idx + 1) & mask;
    }
}

int hash_table_delete(hash_table_t *ht, uint64_t key) {
    size_t mask = ht->capacity - 1;
    size_t idx = mix64(key) & mask;
    for (;;) {
        hash_bucket_t *b = &ht->buckets[idx];
        if (b->state == 0) {
            return -1;
        }
        if (b->state == 1 && b->key == key) {
            b->state = 2;
            ht->size--;
            return 0;
        }
        idx = (idx + 1) & mask;
    }
}

static int rehash(hash_table_t *ht, size_t new_cap) {
    hash_bucket_t *old = ht->buckets;
    size_t old_cap = ht->capacity;

    ht->capacity = new_cap;
    ht->size = 0;
    ht->buckets = (hash_bucket_t *)calloc(ht->capacity, sizeof(hash_bucket_t));
    if (!ht->buckets) {
        ht->buckets = old;
        ht->capacity = old_cap;
        return -1;
    }
    for (size_t i = 0; i < old_cap; i++) {
        if (old[i].state == 1) {
            hash_table_put(ht, old[i].key, old[i].value);
        }
    }
    free(old);
    return 0;
}

static int maybe_grow(hash_table_t *ht) {
    if ((ht->size + 1) * 10 >= ht->capacity * 7) { /* load factor ~0.7 */
        size_t new_cap = ht->capacity << 1;
        if (rehash(ht, new_cap) != 0) {
            return -1;
        }
    }
    return 0;
}

