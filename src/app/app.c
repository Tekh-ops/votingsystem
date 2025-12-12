#include "app.h"
#include "../auth/auth.h"
#include "../core/selection_tree.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <inttypes.h>
#include <sys/stat.h>
#ifdef _WIN32
#include <direct.h>
#endif

static void hex_encode(const uint8_t *src, size_t len, char *dst, size_t dst_len) {
    static const char *hex = "0123456789abcdef";
    size_t out = 0;
    for (size_t i = 0; i < len && out + 2 < dst_len; i++) {
        dst[out++] = hex[(src[i] >> 4) & 0xF];
        dst[out++] = hex[src[i] & 0xF];
    }
    dst[out] = 0;
}

static int hex_decode(const char *hexstr, uint8_t *dst, size_t dst_len) {
    size_t len = strlen(hexstr);
    if (len != dst_len * 2) return -1;
    for (size_t i = 0; i < dst_len; i++) {
        char c1 = hexstr[2 * i], c2 = hexstr[2 * i + 1];
        int v1 = (c1 >= '0' && c1 <= '9') ? c1 - '0' :
                 (c1 >= 'a' && c1 <= 'f') ? c1 - 'a' + 10 :
                 (c1 >= 'A' && c1 <= 'F') ? c1 - 'A' + 10 : -1;
        int v2 = (c2 >= '0' && c2 <= '9') ? c2 - '0' :
                 (c2 >= 'a' && c2 <= 'f') ? c2 - 'a' + 10 :
                 (c2 >= 'A' && c2 <= 'F') ? c2 - 'A' + 10 : -1;
        if (v1 < 0 || v2 < 0) return -1;
        dst[i] = (uint8_t)((v1 << 4) | v2);
    }
    return 0;
}

static uint64_t email_hash64(const char *s) {
    uint64_t h = 1469598103934665603ULL;
    while (*s) {
        unsigned char c = (unsigned char)*s++;
        h ^= c;
        h *= 1099511628211ULL;
    }
    return h;
}

static uint64_t vote_key(uint64_t election_id, uint64_t voter_id) {
    return (election_id << 32) ^ (voter_id & 0xffffffffULL);
}

static election_rec_t *find_election_by_id(app_state_t *app, uint64_t id) {
    uint64_t ptr = 0;
    if (hash_table_get(&app->election_by_id, id, &ptr) == 0) {
        return (election_rec_t *)(uintptr_t)ptr;
    }
    return NULL;
}

int app_init(app_state_t *app) {
    memset(app, 0, sizeof(*app));
    list_init(&app->users);
    list_init(&app->elections);
    list_init(&app->votes);
    if (hash_table_init(&app->user_by_id, 64) != 0) return -1;
    if (hash_table_init(&app->user_by_email, 64) != 0) return -1;
    if (hash_table_init(&app->election_by_id, 64) != 0) return -1;
    if (hash_table_init(&app->has_voted, 64) != 0) return -1;
    app->next_user_id = 1;
    app->next_election_id = 1;
    app->next_vote_id = 1;
    app->current_user = NULL;
    strncpy(app->admin_pin, "1234", sizeof(app->admin_pin) - 1);
    app->admin_exists = 0;
    return 0;
}

static void free_node(void *ptr) {
    free(ptr);
}

void app_free(app_state_t *app) {
    list_clear(&app->users, free_node);
    list_clear(&app->elections, free_node);
    list_clear(&app->votes, free_node);
    hash_table_free(&app->user_by_id);
    hash_table_free(&app->user_by_email);
    hash_table_free(&app->election_by_id);
    hash_table_free(&app->has_voted);
}

int app_register_user(app_state_t *app, const char *name, const char *email, const char *password, role_t role) {
    if (role == ROLE_ADMIN && app->admin_exists) {
        return -1; /* only one admin allowed */
    }
    uint64_t h = email_hash64(email);
    uint64_t dummy;
    if (hash_table_get(&app->user_by_email, h, &dummy) == 0) {
        return -1; /* already exists */
    }
    user_rec_t *u = (user_rec_t *)calloc(1, sizeof(user_rec_t));
    if (!u) return -1;
    u->id = app->next_user_id++;
    strncpy(u->name, name, MAX_NAME - 1);
    strncpy(u->email, email, sizeof(u->email) - 1);
    u->role = role;
    u->active = 1;
    /* salt can be zeros for demo */
    auth_hash_password(u->salt, password, u->pass_hash);
    if (list_push_back(&app->users, u) != 0) return -1;
    hash_table_put(&app->user_by_id, u->id, (uint64_t)(uintptr_t)u);
    hash_table_put(&app->user_by_email, h, (uint64_t)(uintptr_t)u);
    if (role == ROLE_ADMIN) {
        app->admin_exists = 1;
    }
    return 0;
}

int app_login(app_state_t *app, const char *email, const char *password, const char *admin_pin_opt) {
    uint64_t h = email_hash64(email);
    uint64_t ptr = 0;
    if (hash_table_get(&app->user_by_email, h, &ptr) != 0) return -1;
    user_rec_t *u = (user_rec_t *)(uintptr_t)ptr;
    if (auth_verify_password(u, password) != 0) return -1;
    if (u->role == ROLE_ADMIN) {
        if (!admin_pin_opt || strcmp(admin_pin_opt, app->admin_pin) != 0) {
            return -1;
        }
    }
    app->current_user = u;
    return 0;
}

void app_logout(app_state_t *app) {
    app->current_user = NULL;
}

int app_create_election(app_state_t *app, const char *title, const char *desc, char candidates[][64], uint32_t cand_count) {
    if (!app->current_user || app->current_user->role != ROLE_ADMIN) return -1;
    election_rec_t *el = (election_rec_t *)calloc(1, sizeof(election_rec_t));
    if (!el) return -1;
    el->id = app->next_election_id++;
    strncpy(el->title, title, TITLE_LEN - 1);
    strncpy(el->description, desc, DESC_LEN - 1);
    el->phase = ELECTION_CREATED;
    el->candidate_count = cand_count;
    for (uint32_t i = 0; i < cand_count; i++) {
        strncpy(el->candidates[i], candidates[i], sizeof(el->candidates[i]) - 1);
    }
    list_push_back(&app->elections, el);
    hash_table_put(&app->election_by_id, el->id, (uint64_t)(uintptr_t)el);
    return 0;
}

int app_open_voting(app_state_t *app, uint64_t election_id) {
    election_rec_t *el = find_election_by_id(app, election_id);
    if (!el || !app->current_user || app->current_user->role != ROLE_ADMIN) return -1;
    if (el->phase == ELECTION_CREATED || el->phase == REGISTRATION_OPEN) {
        el->phase = VOTING_OPEN;
        return 0;
    }
    return -1;
}

int app_close_voting(app_state_t *app, uint64_t election_id) {
    election_rec_t *el = find_election_by_id(app, election_id);
    if (!el || !app->current_user || app->current_user->role != ROLE_ADMIN) return -1;
    if (el->phase == VOTING_OPEN) {
        el->phase = VOTING_CLOSED;
        return 0;
    }
    return -1;
}

int app_cast_vote(app_state_t *app, uint64_t election_id, uint32_t choice) {
    if (!app->current_user) return -1;
    election_rec_t *el = find_election_by_id(app, election_id);
    if (!el || el->phase != VOTING_OPEN) return -1;
    if (choice >= el->candidate_count) return -1;
    uint64_t key = vote_key(election_id, app->current_user->id);
    uint64_t dummy;
    if (hash_table_get(&app->has_voted, key, &dummy) == 0) {
        return -1; /* already voted */
    }
    vote_rec_t *v = (vote_rec_t *)calloc(1, sizeof(vote_rec_t));
    if (!v) return -1;
    v->id = app->next_vote_id++;
    v->election_id = election_id;
    v->voter_id = app->current_user->id;
    v->choice = choice;
    list_push_back(&app->votes, v);
    hash_table_put(&app->has_voted, key, 1);
    return 0;
}

int app_tally(app_state_t *app, uint64_t election_id) {
    election_rec_t *el = find_election_by_id(app, election_id);
    if (!el) return -1;
    uint64_t counts[MAX_CAND] = {0};
    for (list_node_t *node = app->votes.head; node; node = node->next) {
        vote_rec_t *v = (vote_rec_t *)node->data;
        if (v->election_id == election_id && v->choice < el->candidate_count) {
            counts[v->choice]++;
        }
    }
    selection_tree_t tree;
    if (selection_tree_build(&tree, counts, el->candidate_count) != 0) {
        return -1;
    }
    size_t win = selection_tree_winner(&tree);
    printf("Tally for election %" PRIu64 " (%s):\n", el->id, el->title);
    for (uint32_t i = 0; i < el->candidate_count; i++) {
        printf("  [%u] %-20s : %" PRIu64 "\n", i, el->candidates[i], counts[i]);
    }
    printf("Winner: [%zu] %s\n", win, el->candidates[win]);
    selection_tree_free(&tree);
    return 0;
}

void app_list_elections(app_state_t *app) {
    puts("Elections:");
    for (list_node_t *node = app->elections.head; node; node = node->next) {
        election_rec_t *el = (election_rec_t *)node->data;
        printf("  ID=%" PRIu64 " title=%s phase=%d candidates=%u\n",
               el->id, el->title, el->phase, el->candidate_count);
    }
}

void app_list_users(app_state_t *app) {
    puts("Users:");
    for (list_node_t *node = app->users.head; node; node = node->next) {
        user_rec_t *u = (user_rec_t *)node->data;
        printf("  ID=%" PRIu64 " name=%s email=%s role=%s\n",
               u->id, u->name, u->email, u->role == ROLE_ADMIN ? "admin" : "voter");
    }
}

int app_export_votes_csv(app_state_t *app, const char *path) {
    FILE *f = fopen(path, "w");
    if (!f) return -1;
    fputs("id,election_id,voter_id,choice\n", f);
    for (list_node_t *node = app->votes.head; node; node = node->next) {
        vote_rec_t *v = (vote_rec_t *)node->data;
        fprintf(f, "%" PRIu64 ",%" PRIu64 ",%" PRIu64 ",%u\n",
                v->id, v->election_id, v->voter_id, v->choice);
    }
    fclose(f);
    return 0;
}

typedef struct {
    uint8_t admin_exists;
    char admin_pin[32];
    uint64_t next_user_id;
    uint64_t next_election_id;
    uint64_t next_vote_id;
} state_header_t;

static int ensure_dir(const char *dir) {
#ifdef _WIN32
    _mkdir(dir);
#else
    mkdir(dir, 0700);
#endif
    return 0;
}

static void join_candidates(election_rec_t *el, char *buf, size_t bufsz) {
    buf[0] = 0;
    for (uint32_t i = 0; i < el->candidate_count; i++) {
        if (i > 0 && strlen(buf) + 1 < bufsz) {
            strncat(buf, "|", bufsz - strlen(buf) - 1);
        }
        strncat(buf, el->candidates[i], bufsz - strlen(buf) - 1);
    }
}

static uint32_t split_candidates(const char *s, election_rec_t *el) {
    char tmp[1024];
    strncpy(tmp, s, sizeof(tmp) - 1);
    tmp[sizeof(tmp) - 1] = 0;
    uint32_t count = 0;
    char *tok = strtok(tmp, "|");
    while (tok && count < MAX_CAND) {
        strncpy(el->candidates[count], tok, sizeof(el->candidates[count]) - 1);
        el->candidates[count][sizeof(el->candidates[count]) - 1] = 0;
        count++;
        tok = strtok(NULL, "|");
    }
    el->candidate_count = count;
    return count;
}

int app_save_to_disk(app_state_t *app, const char *dir) {
    ensure_dir(dir);
    char path[256];
    /* state.csv */
    snprintf(path, sizeof(path), "%s/state.csv", dir);
    FILE *fs = fopen(path, "w");
    if (fs) {
        fprintf(fs, "admin_exists,admin_pin,next_user_id,next_election_id,next_vote_id\n");
        fprintf(fs, "%u,%s,%" PRIu64 ",%" PRIu64 ",%" PRIu64 "\n",
                app->admin_exists ? 1u : 0u, app->admin_pin,
                app->next_user_id, app->next_election_id, app->next_vote_id);
        fclose(fs);
    }
    /* users.csv */
    snprintf(path, sizeof(path), "%s/users.csv", dir);
    FILE *fu = fopen(path, "w");
    if (!fu) return -1;
    fprintf(fu, "id,name,email,role,active,salt_hex,hash_hex\n");
    for (list_node_t *n = app->users.head; n; n = n->next) {
        user_rec_t *u = (user_rec_t *)n->data;
        char salt_hex[SALT_LEN * 2 + 1];
        char hash_hex[HASH_LEN * 2 + 1];
        hex_encode(u->salt, SALT_LEN, salt_hex, sizeof(salt_hex));
        hex_encode(u->pass_hash, HASH_LEN, hash_hex, sizeof(hash_hex));
        fprintf(fu, "%" PRIu64 ",%s,%s,%u,%u,%s,%s\n",
                u->id, u->name, u->email, (unsigned)u->role, (unsigned)u->active, salt_hex, hash_hex);
    }
    fclose(fu);
    /* elections.csv */
    snprintf(path, sizeof(path), "%s/elections.csv", dir);
    FILE *fe = fopen(path, "w");
    if (!fe) return -1;
    fprintf(fe, "id,title,description,phase,candidate_count,candidates\n");
    for (list_node_t *n = app->elections.head; n; n = n->next) {
        election_rec_t *el = (election_rec_t *)n->data;
        char cand_buf[2048];
        join_candidates(el, cand_buf, sizeof(cand_buf));
        fprintf(fe, "%" PRIu64 ",%s,%s,%u,%u,%s\n",
                el->id, el->title, el->description, (unsigned)el->phase, el->candidate_count, cand_buf);
    }
    fclose(fe);
    /* votes.csv */
    snprintf(path, sizeof(path), "%s/votes.csv", dir);
    FILE *fv = fopen(path, "w");
    if (!fv) return -1;
    fprintf(fv, "id,election_id,voter_id,choice\n");
    for (list_node_t *n = app->votes.head; n; n = n->next) {
        vote_rec_t *v = (vote_rec_t *)n->data;
        fprintf(fv, "%" PRIu64 ",%" PRIu64 ",%" PRIu64 ",%u\n",
                v->id, v->election_id, v->voter_id, v->choice);
    }
    fclose(fv);
    return 0;
}

int app_load_from_disk(app_state_t *app, const char *dir) {
    char path[256];
    /* state.csv */
    snprintf(path, sizeof(path), "%s/state.csv", dir);
    FILE *fs = fopen(path, "r");
    if (fs) {
        char line[256];
        fgets(line, sizeof(line), fs); /* header */
        if (fgets(line, sizeof(line), fs)) {
            char *tok = strtok(line, ",");
            if (tok) app->admin_exists = (uint8_t)atoi(tok);
            tok = strtok(NULL, ",");
            if (tok) strncpy(app->admin_pin, tok, sizeof(app->admin_pin) - 1);
            tok = strtok(NULL, ",");
            if (tok) app->next_user_id = strtoull(tok, NULL, 10);
            tok = strtok(NULL, ",");
            if (tok) app->next_election_id = strtoull(tok, NULL, 10);
            tok = strtok(NULL, ",");
            if (tok) app->next_vote_id = strtoull(tok, NULL, 10);
        }
        fclose(fs);
    }
    /* users.csv */
    snprintf(path, sizeof(path), "%s/users.csv", dir);
    FILE *fu = fopen(path, "r");
    if (fu) {
        char line[512];
        fgets(line, sizeof(line), fu); /* header */
        while (fgets(line, sizeof(line), fu)) {
            char *tok = strtok(line, ",");
            if (!tok) continue;
            user_rec_t *u = (user_rec_t *)calloc(1, sizeof(user_rec_t));
            u->id = strtoull(tok, NULL, 10);
            if ((tok = strtok(NULL, ","))) strncpy(u->name, tok, sizeof(u->name) - 1);
            if ((tok = strtok(NULL, ","))) strncpy(u->email, tok, sizeof(u->email) - 1);
            if ((tok = strtok(NULL, ","))) u->role = (role_t)atoi(tok);
            if ((tok = strtok(NULL, ","))) u->active = (uint8_t)atoi(tok);
            if ((tok = strtok(NULL, ","))) hex_decode(tok, u->salt, SALT_LEN);
            if ((tok = strtok(NULL, ","))) {
                tok[strcspn(tok, "\r\n")] = 0;
                hex_decode(tok, u->pass_hash, HASH_LEN);
            }
            list_push_back(&app->users, u);
            hash_table_put(&app->user_by_id, u->id, (uint64_t)(uintptr_t)u);
            hash_table_put(&app->user_by_email, email_hash64(u->email), (uint64_t)(uintptr_t)u);
            if (u->role == ROLE_ADMIN) app->admin_exists = 1;
            if (u->id >= app->next_user_id) app->next_user_id = u->id + 1;
        }
        fclose(fu);
    }
    /* elections.csv */
    snprintf(path, sizeof(path), "%s/elections.csv", dir);
    FILE *fe = fopen(path, "r");
    if (fe) {
        char line[4096];
        fgets(line, sizeof(line), fe); /* header */
        while (fgets(line, sizeof(line), fe)) {
            char *tok = strtok(line, ",");
            if (!tok) continue;
            election_rec_t *el = (election_rec_t *)calloc(1, sizeof(election_rec_t));
            el->id = strtoull(tok, NULL, 10);
            if ((tok = strtok(NULL, ","))) strncpy(el->title, tok, sizeof(el->title) - 1);
            if ((tok = strtok(NULL, ","))) strncpy(el->description, tok, sizeof(el->description) - 1);
            if ((tok = strtok(NULL, ","))) el->phase = (election_phase_t)atoi(tok);
            if ((tok = strtok(NULL, ","))) el->candidate_count = (uint32_t)strtoul(tok, NULL, 10);
            if ((tok = strtok(NULL, ","))) {
                tok[strcspn(tok, "\r\n")] = 0;
                split_candidates(tok, el);
            }
            list_push_back(&app->elections, el);
            hash_table_put(&app->election_by_id, el->id, (uint64_t)(uintptr_t)el);
            if (el->id >= app->next_election_id) app->next_election_id = el->id + 1;
        }
        fclose(fe);
    }
    /* votes.csv */
    snprintf(path, sizeof(path), "%s/votes.csv", dir);
    FILE *fv = fopen(path, "r");
    if (fv) {
        char line[256];
        fgets(line, sizeof(line), fv); /* header */
        while (fgets(line, sizeof(line), fv)) {
            vote_rec_t *v = (vote_rec_t *)calloc(1, sizeof(vote_rec_t));
            char *tok = strtok(line, ",");
            if (!tok) { free(v); continue; }
            v->id = strtoull(tok, NULL, 10);
            if ((tok = strtok(NULL, ","))) v->election_id = strtoull(tok, NULL, 10);
            if ((tok = strtok(NULL, ","))) v->voter_id = strtoull(tok, NULL, 10);
            if ((tok = strtok(NULL, ","))) v->choice = (uint32_t)strtoul(tok, NULL, 10);
            list_push_back(&app->votes, v);
            uint64_t key = vote_key(v->election_id, v->voter_id);
            hash_table_put(&app->has_voted, key, 1);
            if (v->id >= app->next_vote_id) app->next_vote_id = v->id + 1;
        }
        fclose(fv);
    }
    app->current_user = NULL;
    return 0;
}

