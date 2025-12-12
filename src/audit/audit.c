#include "audit.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int audit_init(audit_ctx_t *ctx) {
    queue_init(&ctx->pending);
    return 0;
}

int audit_append(audit_ctx_t *ctx, const char *entry) {
    char *dup = strdup(entry);
    if (!dup) {
        return -1;
    }
    return queue_enqueue(&ctx->pending, dup);
}

void audit_flush(audit_ctx_t *ctx, const char *path) {
    FILE *f = fopen(path, "a");
    if (!f) {
        return;
    }
    while (!queue_empty(&ctx->pending)) {
        char *line = (char *)queue_dequeue(&ctx->pending);
        if (line) {
            fputs(line, f);
            fputc('\n', f);
            free(line);
        }
    }
    fclose(f);
}

void audit_close(audit_ctx_t *ctx) {
    queue_clear(&ctx->pending, free);
}

