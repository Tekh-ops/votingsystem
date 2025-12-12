#pragma once
#include <stdint.h>
#include "../core/hash_table.h"

typedef struct {
    hash_table_t id_to_offset;
} storage_index_t;

typedef struct {
    storage_index_t users;
    storage_index_t elections;
    storage_index_t votes;
} storage_ctx_t;

int storage_init(storage_ctx_t *ctx);
void storage_close(storage_ctx_t *ctx);

