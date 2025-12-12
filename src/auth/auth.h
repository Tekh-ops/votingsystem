#pragma once
#include <stdint.h>
#include "../models/user.h"

int auth_hash_password(const uint8_t *salt, const char *password, uint8_t *out_hash);
int auth_verify_password(const user_rec_t *user, const char *password);

