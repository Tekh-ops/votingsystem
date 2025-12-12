#pragma once
#include <stdint.h>

#define MAX_NAME 64
#define SALT_LEN 16
#define HASH_LEN 32

typedef enum { ROLE_VOTER, ROLE_ADMIN } role_t;

typedef struct {
    uint64_t id;
    char name[MAX_NAME];
    char email[128];
    role_t role;
    uint8_t salt[SALT_LEN];
    uint8_t pass_hash[HASH_LEN];
    uint8_t active;
} user_rec_t;

