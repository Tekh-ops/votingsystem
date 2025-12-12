#pragma once
#include <stdint.h>
#include <stdio.h>

typedef struct {
    FILE *file;
} wal_t;

int wal_open(wal_t *wal, const char *path);
int wal_append(wal_t *wal, const void *data, uint32_t len);
void wal_close(wal_t *wal);

