#!/bin/bash

# Set the path to the directory containing the gschema XML files
SCHEMA_DIR=$(dirname "$0")/schemas

# Compile the gschema XML files
glib-compile-schemas "$SCHEMA_DIR"
