"""Compose entry point for one-time, retrying database schema initialization."""

from src.database import wait_for_database_initialization


if __name__ == "__main__":
    wait_for_database_initialization()
