#pragma once
#include <stdint.h>
#include <time.h>

#define TITLE_LEN 128
#define DESC_LEN 512
#define MAX_CAND 128

typedef enum {
    ELECTION_CREATED,
    REGISTRATION_OPEN,
    VOTING_OPEN,
    VOTING_CLOSED,
    TALLY_COMPLETE
} election_phase_t;

typedef struct {
    uint64_t id;
    char title[TITLE_LEN];
    char description[DESC_LEN];
    election_phase_t phase;
    time_t start_time;
    time_t end_time;
    uint32_t candidate_count;
    char candidates[MAX_CAND][64];
} election_rec_t;

