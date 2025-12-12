#include "cli.h"
#include "../app/app.h"
#include "../core/hash_table.h"
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <inttypes.h>

static void read_line(char *buf, size_t sz) {
    if (fgets(buf, (int)sz, stdin)) {
        buf[strcspn(buf, "\n")] = 0;
    } else {
        buf[0] = 0;
    }
}

static int prompt_uint64(const char *label, uint64_t *out) {
    char line[128];
    printf("%s: ", label);
    read_line(line, sizeof(line));
    char *end;
    unsigned long long v = strtoull(line, &end, 10);
    if (end == line) return -1;
    *out = (uint64_t)v;
    return 0;
}

static int prompt_uint32(const char *label, uint32_t *out) {
    uint64_t v;
    if (prompt_uint64(label, &v) != 0) return -1;
    *out = (uint32_t)v;
    return 0;
}

static int tally_from_csv_files(char *paths_csv) {
    char *paths = strdup(paths_csv);
    if (!paths) return -1;
    size_t file_cap = 8, file_count = 0;
    char **files = malloc(file_cap * sizeof(char *));
    if (!files) {
        free(paths);
        return -1;
    }
    char *tok = strtok(paths, ",");
    while (tok) {
        if (file_count == file_cap) {
            file_cap *= 2;
            char **nf = realloc(files, file_cap * sizeof(char *));
            if (!nf) { free(files); free(paths); return -1; }
            files = nf;
        }
        files[file_count++] = tok;
        tok = strtok(NULL, ",");
    }

    hash_table_t counts;
    hash_table_init(&counts, 128);

    char line[256];
    for (size_t i = 0; i < file_count; i++) {
        FILE *f = fopen(files[i], "r");
        if (!f) {
            fprintf(stderr, "Could not open %s\n", files[i]);
            continue;
        }
        while (fgets(line, sizeof(line), f)) {
            if (strncmp(line, "id,", 3) == 0) continue; /* header */
            char *id_s = strtok(line, ",");
            char *eid_s = strtok(NULL, ",");
            (void)id_s;
            char *vid_s = strtok(NULL, ",");
            (void)vid_s;
            char *choice_s = strtok(NULL, ",");
            if (!eid_s || !choice_s) continue;
            uint64_t eid = strtoull(eid_s, NULL, 10);
            uint64_t choice = strtoull(choice_s, NULL, 10);
            uint64_t key = (eid << 32) | (choice & 0xffffffffULL);
            uint64_t val = 0;
            if (hash_table_get(&counts, key, &val) == 0) {
                val++;
                hash_table_put(&counts, key, val);
            } else {
                hash_table_put(&counts, key, 1);
            }
        }
        fclose(f);
    }

    puts("Aggregated tally (from CSV files):");
    for (size_t i = 0; i < counts.capacity; i++) {
        hash_bucket_t *b = &counts.buckets[i];
        if (b->state == 1) {
            uint64_t key = b->key;
            uint64_t eid = key >> 32;
            uint32_t choice = (uint32_t)(key & 0xffffffffULL);
            printf("  election=%" PRIu64 " choice=%u -> %" PRIu64 " votes\n", eid, choice, b->value);
        }
    }

    hash_table_free(&counts);
    free(files);
    free(paths);
    return 0;
}

static void menu_loop(app_state_t *app) {
    for (;;) {
        printf("\nLogin as (1=Admin, 2=Voter, 0=Exit): ");
        char line[16]; read_line(line, sizeof(line));
        int role_choice = atoi(line);
        if (role_choice == 0) break;
        if (role_choice == 1) {
            char email[128], pass[128], pin[64];
            printf("Admin email: "); read_line(email, sizeof(email));
            printf("Password: "); read_line(pass, sizeof(pass));
            printf("Admin PIN: "); read_line(pin, sizeof(pin));
            if (app_login(app, email, pass, pin) != 0) {
                puts("Admin login failed.");
                continue;
            }
            for (;;) {
                puts("\n-- ADMIN MENU --");
                puts("1) Create election");
                puts("2) List elections");
                puts("3) Open voting");
                puts("4) Close voting");
                puts("5) Tally election");
                puts("6) Export local votes to CSV");
                puts("7) Aggregate CSV files");
                puts("8) List users");
                puts("9) Logout");
                printf("Choose: ");
                char a[16]; read_line(a, sizeof(a));
                int c = atoi(a);
                if (c == 9) { app_logout(app); break; }
                if (c == 1) {
                    char title[128], desc[256], candline[512];
                    printf("Title: "); read_line(title, sizeof(title));
                    printf("Description: "); read_line(desc, sizeof(desc));
                    printf("Candidates (comma separated): "); read_line(candline, sizeof(candline));
                    char candidates[MAX_CAND][64];
                    uint32_t count = 0;
                    char *tok = strtok(candline, ",");
                    while (tok && count < MAX_CAND) {
                        strncpy(candidates[count], tok, 63);
                        candidates[count][63] = 0;
                        count++;
                        tok = strtok(NULL, ",");
                    }
                    if (count == 0) {
                        puts("No candidates provided.");
                    } else if (app_create_election(app, title, desc, candidates, count) == 0) {
                        puts("Election created.");
                    } else {
                        puts("Failed to create election (need admin login?).");
                    }
                } else if (c == 2) {
                    app_list_elections(app);
                } else if (c == 3) {
                    uint64_t eid;
                    if (prompt_uint64("Election ID", &eid) == 0 && app_open_voting(app, eid) == 0)
                        puts("Voting opened.");
                    else
                        puts("Failed (phase incorrect?).");
                } else if (c == 4) {
                    uint64_t eid;
                    if (prompt_uint64("Election ID", &eid) == 0 && app_close_voting(app, eid) == 0)
                        puts("Voting closed.");
                    else
                        puts("Failed (phase incorrect?).");
                } else if (c == 5) {
                    uint64_t eid;
                    if (prompt_uint64("Election ID", &eid) == 0 && app_tally(app, eid) == 0)
                        ;
                    else
                        puts("Tally failed.");
                } else if (c == 6) {
                    char path[256];
                    printf("CSV output path: ");
                    read_line(path, sizeof(path));
                    if (app_export_votes_csv(app, path) == 0)
                        puts("Exported votes CSV.");
                    else
                        puts("Export failed.");
                } else if (c == 7) {
                    char paths[512];
                    printf("CSV file paths (comma separated): ");
                    read_line(paths, sizeof(paths));
                    if (tally_from_csv_files(paths) != 0)
                        puts("Aggregation failed.");
                } else if (c == 8) {
                    app_list_users(app);
                } else {
                    puts("Unknown choice.");
                }
            }
        } else if (role_choice == 2) {
            for (;;) {
                puts("\n-- VOTER MENU --");
                puts("1) Register");
                puts("2) Login");
                puts("3) List elections");
                puts("4) Cast vote");
                puts("5) Logout");
                puts("0) Back");
                printf("Choose: ");
                char vline[16]; read_line(vline, sizeof(vline));
                int vc = atoi(vline);
                if (vc == 0) break;
                if (vc == 1) {
                    char name[128], email[128], pass[128];
                    printf("Name: "); read_line(name, sizeof(name));
                    printf("Email: "); read_line(email, sizeof(email));
                    printf("Password: "); read_line(pass, sizeof(pass));
                    if (app_register_user(app, name, email, pass, ROLE_VOTER) == 0)
                        puts("Registered.");
                    else
                        puts("Registration failed (email exists or admin limit).");
                } else if (vc == 2) {
                    char email[128], pass[128];
                    printf("Email: "); read_line(email, sizeof(email));
                    printf("Password: "); read_line(pass, sizeof(pass));
                    if (app_login(app, email, pass, NULL) == 0)
                        puts("Login success.");
                    else
                        puts("Login failed.");
                } else if (vc == 3) {
                    app_list_elections(app);
                } else if (vc == 4) {
                    uint64_t eid;
                    if (prompt_uint64("Election ID", &eid) != 0) { puts("bad id"); continue; }
                    election_rec_t *el = NULL;
                    for (list_node_t *n = app->elections.head; n; n = n->next) {
                        election_rec_t *cand = (election_rec_t *)n->data;
                        if (cand->id == eid) { el = cand; break; }
                    }
                    if (!el) { puts("Election not found."); continue; }
                    if (el->phase != VOTING_OPEN) { puts("Voting not open."); continue; }
                    puts("Candidates:");
                    for (uint32_t i = 0; i < el->candidate_count; i++) {
                        printf("  [%u] %s\n", i, el->candidates[i]);
                    }
                    uint32_t pick;
                    if (prompt_uint32("Choice index", &pick) != 0) { puts("bad choice"); continue; }
                    if (app_cast_vote(app, eid, pick) == 0)
                        puts("Vote cast.");
                    else
                        puts("Failed to cast vote (login? phase? already voted?).");
                } else if (vc == 5) {
                    app_logout(app);
                    puts("Logged out.");
                } else {
                    puts("Unknown choice.");
                }
            }
        } else {
            puts("Unknown role choice.");
        }
    }
}

int cli_run(int argc, char **argv) {
    (void)argc; (void)argv;
    app_state_t app;
    if (app_init(&app) != 0) {
        fprintf(stderr, "init failed\n");
        return -1;
    }
    app_load_from_disk(&app, "data");
    if (!app.admin_exists) {
        app_register_user(&app, "admin", "admin@example.com", "admin", ROLE_ADMIN);
    }
    menu_loop(&app);
    app_save_to_disk(&app, "data");
    app_free(&app);
    return 0;
}

