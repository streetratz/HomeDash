# Specification Changelog

## Table of Contents

- [CH-01 - Initial bug-fix specification](#ch-01---initial-bug-fix-specification)

## CH-01 - Initial bug-fix specification

**Date**: 2026-09-24

Created the specification for #11 after confirming that `v3.2.10` production
containers without an explicit session-secret variable exit during configuration
loading and restart indefinitely.
