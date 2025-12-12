#pragma once
#include <stddef.h>
#include <stdint.h>
#include "../core/selection_tree.h"

int tally_winner(const uint64_t *counts, size_t n, size_t *out_index);

