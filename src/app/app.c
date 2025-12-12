#include "app.h"
#include "../auth/auth.h"
#include "../core/selection_tree.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <inttypes.h>

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
    return 0;
}

int app_login(app_state_t *app, const char *email, const char *password) {
    uint64_t h = email_hash64(email);
    uint64_t ptr = 0;
    if (hash_table_get(&app->user_by_email, h, &ptr) != 0) return -1;
    user_rec_t *u = (user_rec_t *)(uintptr_t)ptr;
    if (auth_verify_password(u, password) != 0) return -1;
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

