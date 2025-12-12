#pragma once
#include <stdint.h>
#include <time.h>

typedef struct {
    uint64_t id;
    uint64_t election_id;
    uint64_t voter_id;
    uint32_t choice;
    time_t timestamp;
    uint8_t signature[256];
} vote_rec_t;

