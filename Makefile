CC = gcc
CFLAGS = -std=c11 -Wall -Wextra -Wpedantic -O2
SRC = $(shell find src -name "*.c" ! -path "*/tests/*")
OBJ = $(SRC:.c=.o)
BIN = bin/onlinevote

all: $(BIN)

$(BIN): $(OBJ)
	@mkdir -p bin
	$(CC) $(CFLAGS) -o $(BIN) $(OBJ)

clean:
	rm -rf $(OBJ) $(BIN)

.PHONY: all clean

