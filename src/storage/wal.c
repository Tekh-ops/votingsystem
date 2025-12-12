#include "wal.h"
#include <string.h>

int wal_open(wal_t *wal, const char *path) {
    wal->file = fopen(path, "ab");
    return wal->file ? 0 : -1;
}

int wal_append(wal_t *wal, const void *data, uint32_t len) {
    if (!wal->file) {
        return -1;
    }
    size_t w = fwrite(data, 1, len, wal->file);
    fflush(wal->file);
    return w == len ? 0 : -1;
}

void wal_close(wal_t *wal) {
    if (wal->file) {
        fclose(wal->file);
        wal->file = NULL;
    }
}

