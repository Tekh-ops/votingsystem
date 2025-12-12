#pragma once
#include <stdint.h>
#include "../core/linked_list.h"
#include "../core/hash_table.h"
#include "../models/user.h"
#include "../models/election.h"
#include "../models/vote.h"

typedef struct {
    uint64_t next_user_id;
    uint64_t next_election_id;
    uint64_t next_vote_id;
    char admin_pin[32];
    int admin_exists;
    linked_list_t users;
    linked_list_t elections;
    linked_list_t votes;
    hash_table_t user_by_id;
    hash_table_t user_by_email;
    hash_table_t election_by_id;
    hash_table_t has_voted; /* key = (election_id << 32) ^ voter_id */
    user_rec_t *current_user;
} app_state_t;

int app_init(app_state_t *app);
void app_free(app_state_t *app);

int app_register_user(app_state_t *app, const char *name, const char *email, const char *password, role_t role);
int app_login(app_state_t *app, const char *email, const char *password, const char *admin_pin_opt);
void app_logout(app_state_t *app);

int app_create_election(app_state_t *app, const char *title, const char *desc, char candidates[][64], uint32_t cand_count);
int app_open_voting(app_state_t *app, uint64_t election_id);
int app_close_voting(app_state_t *app, uint64_t election_id);
int app_cast_vote(app_state_t *app, uint64_t election_id, uint32_t choice);
int app_tally(app_state_t *app, uint64_t election_id);
void app_list_elections(app_state_t *app);
void app_list_users(app_state_t *app);
int app_export_votes_csv(app_state_t *app, const char *path);
int app_save_to_disk(app_state_t *app, const char *dir);
int app_load_from_disk(app_state_t *app, const char *dir);
int app_save(app_state_t *app, const char *dir);
int app_load(app_state_t *app, const char *dir);

