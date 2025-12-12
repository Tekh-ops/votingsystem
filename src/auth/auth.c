#include "auth.h"
#include <string.h>

/* Note: this is a simple placeholder hash for portability; replace with
 * a real KDF (PBKDF2/bcrypt/Argon2) for production. */
static void simple_hash(const uint8_t *salt, const char *password, uint8_t *out_hash) {
    uint32_t h0 = 0x811c9dc5u;
    for (size_t i = 0; i < SALT_LEN; i++) {
        h0 ^= salt[i];
        h0 *= 16777619u;
    }
    for (const unsigned char *p = (const unsigned char *)password; *p; p++) {
        h0 ^= *p;
        h0 *= 16777619u;
    }
    /* Expand into 32 bytes */
    for (size_t i = 0; i < HASH_LEN; i++) {
        h0 ^= (h0 << 13);
        h0 ^= (h0 >> 7);
        h0 ^= (h0 << 17);
        out_hash[i] = (uint8_t)(h0 & 0xFFu);
    }
}

int auth_hash_password(const uint8_t *salt, const char *password, uint8_t *out_hash) {
    simple_hash(salt, password, out_hash);
    return 0;
}

int auth_verify_password(const user_rec_t *user, const char *password) {
    uint8_t hash[HASH_LEN];
    auth_hash_password(user->salt, password, hash);
    return memcmp(hash, user->pass_hash, HASH_LEN) == 0 ? 0 : -1;
}

