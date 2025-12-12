#pragma once
#include <stdint.h>
#include "../core/queue.h"

typedef struct {
    queue_t pending;
} audit_ctx_t;

int audit_init(audit_ctx_t *ctx);
int audit_append(audit_ctx_t *ctx, const char *entry);
void audit_flush(audit_ctx_t *ctx, const char *path);
void audit_close(audit_ctx_t *ctx);

