#include "storage.h"

int storage_init(storage_ctx_t *ctx) {
    if (hash_table_init(&ctx->users.id_to_offset, 64) != 0) return -1;
    if (hash_table_init(&ctx->elections.id_to_offset, 64) != 0) return -1;
    if (hash_table_init(&ctx->votes.id_to_offset, 64) != 0) return -1;
    return 0;
}

void storage_close(storage_ctx_t *ctx) {
    hash_table_free(&ctx->users.id_to_offset);
    hash_table_free(&ctx->elections.id_to_offset);
    hash_table_free(&ctx->votes.id_to_offset);
    (void)ctx;
}

