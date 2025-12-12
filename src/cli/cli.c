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
        puts("\n=== Online Vote Menu ===");
        printf("Logged in: %s\n", app->current_user ? app->current_user->email : "(none)");
        puts("1) Register user");
        puts("2) Login");
        puts("3) Logout");
        puts("4) List users");
        puts("5) Create election (admin)");
        puts("6) List elections");
        puts("7) Open voting (admin)");
        puts("8) Close voting (admin)");
        puts("9) Cast vote");
        puts("10) Tally election");
        puts("11) Export local votes to CSV");
        puts("12) Aggregate CSV files (admin machine)");
        puts("0) Exit");
        printf("Choose: ");
        char line[16];
        read_line(line, sizeof(line));
        int choice = atoi(line);
        if (choice == 0) break;
        if (choice == 1) {
            char name[128], email[128], pass[128], role[16];
            printf("Name: "); read_line(name, sizeof(name));
            printf("Email: "); read_line(email, sizeof(email));
            printf("Password: "); read_line(pass, sizeof(pass));
            printf("Role (voter/admin): "); read_line(role, sizeof(role));
            role_t r = (strcmp(role, "admin") == 0) ? ROLE_ADMIN : ROLE_VOTER;
            if (app_register_user(app, name, email, pass, r) == 0)
                puts("Registered.");
            else
                puts("Registration failed (maybe email exists).");
        } else if (choice == 2) {
            char email[128], pass[128];
            printf("Email: "); read_line(email, sizeof(email));
            printf("Password: "); read_line(pass, sizeof(pass));
            if (app_login(app, email, pass) == 0)
                puts("Login success.");
            else
                puts("Login failed.");
        } else if (choice == 3) {
            app_logout(app);
            puts("Logged out.");
        } else if (choice == 4) {
            app_list_users(app);
        } else if (choice == 5) {
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
        } else if (choice == 6) {
            app_list_elections(app);
        } else if (choice == 7) {
            uint64_t eid;
            if (prompt_uint64("Election ID", &eid) == 0 && app_open_voting(app, eid) == 0)
                puts("Voting opened.");
            else
                puts("Failed (admin login? phase incorrect?).");
        } else if (choice == 8) {
            uint64_t eid;
            if (prompt_uint64("Election ID", &eid) == 0 && app_close_voting(app, eid) == 0)
                puts("Voting closed.");
            else
                puts("Failed (admin login? phase incorrect?).");
        } else if (choice == 9) {
            uint64_t eid;
            uint32_t pick;
            if (prompt_uint64("Election ID", &eid) != 0) {
                puts("bad id");
                continue;
            }
            if (prompt_uint32("Choice index", &pick) != 0) {
                puts("bad choice");
                continue;
            }
            if (app_cast_vote(app, eid, pick) == 0)
                puts("Vote cast.");
            else
                puts("Failed to cast vote (login? phase? already voted?).");
        } else if (choice == 10) {
            uint64_t eid;
            if (prompt_uint64("Election ID", &eid) == 0 && app_tally(app, eid) == 0)
                ;
            else
                puts("Tally failed.");
        } else if (choice == 11) {
            char path[256];
            printf("CSV output path: ");
            read_line(path, sizeof(path));
            if (app_export_votes_csv(app, path) == 0)
                puts("Exported votes CSV.");
            else
                puts("Export failed.");
        } else if (choice == 12) {
            char paths[512];
            printf("CSV file paths (comma separated): ");
            read_line(paths, sizeof(paths));
            if (tally_from_csv_files(paths) != 0)
                puts("Aggregation failed.");
        } else {
            puts("Unknown choice.");
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
    /* seed with default admin */
    app_register_user(&app, "admin", "admin@example.com", "admin", ROLE_ADMIN);
    menu_loop(&app);
    app_free(&app);
    return 0;
}

