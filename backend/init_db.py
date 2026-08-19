"""Container-safe database bootstrap.

`python app.py` seeds by calling seed_database(), which starts with db.drop_all()
— fine for a one-off local reset, destructive on every container restart. This
module instead waits for PostgreSQL, creates any missing tables, and seeds only
when the database is still empty (or when SEED_ON_START is set).
"""
import os
import sys
import time

from sqlalchemy import inspect, text

from app import app
from models import db

MAX_WAIT_SECONDS = int(os.getenv('DB_WAIT_TIMEOUT', '60'))


def wait_for_db():
    deadline = time.time() + MAX_WAIT_SECONDS
    while True:
        try:
            with db.engine.connect() as conn:
                conn.execute(text('SELECT 1'))
            return
        except Exception as exc:
            if time.time() >= deadline:
                print(f'Database unreachable after {MAX_WAIT_SECONDS}s: {exc}', file=sys.stderr)
                raise
            print('Waiting for database...')
            time.sleep(2)


def main():
    with app.app_context():
        wait_for_db()

        force_seed = os.getenv('SEED_ON_START', '').lower() in ('1', 'true', 'yes')
        already_seeded = inspect(db.engine).has_table('staff')

        if force_seed or not already_seeded:
            reason = 'SEED_ON_START is set' if force_seed else 'no existing schema found'
            print(f'Seeding database ({reason})...')
            from seed import seed_database
            seed_database()
        else:
            # Pick up tables added since the last seed without touching existing data.
            db.create_all()
            print('Existing database detected — skipping seed.')


if __name__ == '__main__':
    main()
