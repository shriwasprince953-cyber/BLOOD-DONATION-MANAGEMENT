"""Run with python tests/check_enum_migration.py; requires PostgreSQL tools on PATH.

Uses only a newly initialized temporary PostgreSQL cluster, never DATABASE_URL.
No third-party Python dependencies. The server listens on loopback only.
"""
from pathlib import Path
import os
import shutil
import socket
import subprocess
import tempfile
import unittest


BACKEND = Path(__file__).resolve().parents[1]
INITIAL = (BACKEND / "migrations/001_initial_schema.sql").read_text()
MIGRATION = (BACKEND / "migrations/002_reconcile_enum_types.sql").read_text()
TYPES = {
    "user_role": "userrole", "blood_group": "bloodgroup",
    "urgency_level": "urgencylevel", "requirement_status": "requirementstatus",
    "response_status": "responsestatus", "notification_channel": "notificationchannel",
    "notification_status": "notificationstatus",
}
BLOOD = dict(zip(
    ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
    ["A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG"],
))
SEED = """
INSERT INTO profiles(id, full_name, email)
SELECT md5(n::text)::uuid, 'Migration Test', 'test' || n || '@example.invalid'
FROM generate_series(1, 8) n;
INSERT INTO donors(profile_id, blood_group)
SELECT md5(n::text)::uuid, label::blood_group
FROM unnest(ARRAY['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
WITH ORDINALITY AS x(label, n);
INSERT INTO blood_requirements(id, admin_id, blood_group, units_required,
    urgency_level, patient_name, hospital_name, location)
VALUES (md5('requirement')::uuid, md5('1')::uuid, 'AB+', 1, 'HIGH',
    'Test Patient', 'Test Hospital', 'Test City');
INSERT INTO donation_responses(donor_id, requirement_id)
VALUES (md5('1')::uuid, md5('requirement')::uuid);
INSERT INTO notifications(donor_id, requirement_id, message)
VALUES (md5('1')::uuid, md5('requirement')::uuid, 'Test only');
"""


def run(*args, input=None):
    # A Windows server can inherit pg_ctl's pipes after pg_ctl exits, leaving
    # communicate() waiting indefinitely for EOF. Server logs go to -l instead.
    if args[0] == "pg_ctl":
        result = subprocess.run(
            args, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
        return subprocess.CompletedProcess(args, result.returncode, "", "")
    return subprocess.run(
        args, input=input, capture_output=True, text=True,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
    )


class EnumMigrationCheck(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        for name in ("initdb", "pg_ctl", "psql"):
            if not shutil.which(name):
                raise unittest.SkipTest(f"PostgreSQL executable missing: {name}")
        cls.temp = tempfile.TemporaryDirectory(prefix="blood-enum-check-")
        cls.addClassCleanup(cls.temp.cleanup)
        cls.data = str(Path(cls.temp.name) / "data")
        result = run("initdb", "-D", cls.data, "-U", "enum_test", "-A", "trust", "--no-locale", "-E", "UTF8")
        if result.returncode:
            raise RuntimeError(result.stderr)
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            cls.port = str(sock.getsockname()[1])
        cls.addClassCleanup(run, "pg_ctl", "-D", cls.data, "-m", "immediate", "-w", "stop")
        result = run("pg_ctl", "-D", cls.data, "-l", str(Path(cls.temp.name) / "server.log"),
                     "-o", f"-h 127.0.0.1 -p {cls.port}", "-w", "start")
        if result.returncode:
            raise RuntimeError(result.stderr + result.stdout)

    def sql(self, text, db=None, ok=True):
        result = run("psql", "-X", "-h", "127.0.0.1", "-p", self.port,
                     "-U", "enum_test", "-d", db or self.db,
                     "-v", "ON_ERROR_STOP=1", "-A", "-t", input=text)
        if ok:
            self.assertEqual(result.returncode, 0, result.stderr)
        else:
            self.assertNotEqual(result.returncode, 0, result.stdout)
        return result

    def setUp(self):
        self.db = self._testMethodName
        self.sql(f'CREATE DATABASE "{self.db}";', db="postgres")
        self.sql(INITIAL + SEED)

    def legacy(self):
        self.sql("\n".join(f"ALTER TYPE {new} RENAME TO {old};" for new, old in TYPES.items()))
        self.sql("\n".join(f"ALTER TYPE bloodgroup RENAME VALUE '{value}' TO '{name}';"
                           for value, name in BLOOD.items()))

    def snapshot(self):
        return self.sql("\n".join(
            f"SELECT row_to_json(t)::text FROM {table} t ORDER BY row_to_json(t)::text;"
            for table in ("profiles", "donors", "blood_requirements", "donation_responses", "notifications")
        )).stdout

    def verify(self):
        result = self.sql(MIGRATION)
        self.assertEqual(result.stdout.count("|OK"), 8, result.stdout)
        self.assertEqual(self.sql("SELECT string_agg(blood_group::text, ',' ORDER BY blood_group) FROM donors;").stdout.strip(),
                         "A+,A-,B+,B-,AB+,AB-,O+,O-")
        # Actual PostgreSQL casts/comparisons matching the failing API query.
        self.assertEqual(self.sql("SELECT count(*) FROM blood_requirements WHERE status IN "
                                  "('OPEN'::requirement_status, 'IN_PROGRESS'::requirement_status) "
                                  "AND blood_group = 'AB+'::blood_group;").stdout.strip(), "1")

    def test_current_schema_and_rerun(self):
        before = self.snapshot()
        self.verify()
        self.verify()
        self.assertEqual(before, self.snapshot())

    def test_all_legacy_types_and_defaults(self):
        before = self.snapshot()
        self.legacy()
        self.verify()
        self.assertEqual(before, self.snapshot())
        # Defaults still work after old enum defaults have been converted.
        self.sql("INSERT INTO profiles(id, full_name, email) VALUES "
                 "(md5('extra')::uuid, 'Extra', 'extra@example.invalid'); "
                 "INSERT INTO donation_responses(donor_id, requirement_id) "
                 "VALUES (md5('2')::uuid, md5('requirement')::uuid); "
                 "INSERT INTO notifications(donor_id, requirement_id, message) "
                 "VALUES (md5('2')::uuid, md5('requirement')::uuid, 'extra');")
        self.assertEqual(self.sql("SELECT role::text FROM profiles WHERE email = 'extra@example.invalid';").stdout.strip(), "DONOR")
        self.assertEqual(self.sql("SELECT status::text FROM donation_responses WHERE donor_id = md5('2')::uuid;").stdout.strip(), "PENDING")
        self.assertEqual(self.sql("SELECT channel::text, status::text FROM notifications WHERE donor_id = md5('2')::uuid;").stdout.strip(), "IN_APP|QUEUED")
        self.verify()

    def test_partial_prior_blood_fix(self):
        self.legacy()
        self.sql("CREATE TYPE blood_group AS ENUM ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'); "
                 "ALTER TABLE donors ALTER COLUMN blood_group TYPE blood_group USING "
                 "(replace(replace(blood_group::text, '_POS', '+'), '_NEG', '-'))::blood_group;")
        self.verify()

    def test_unknown_data_rolls_back_earlier_changes(self):
        self.legacy()
        self.sql("ALTER TYPE notificationstatus ADD VALUE 'UNKNOWN';")
        self.sql("UPDATE notifications SET status = 'UNKNOWN';")
        before = self.snapshot()
        result = self.sql(MIGRATION, ok=False)
        self.assertIn("Unsupported value UNKNOWN", result.stderr)
        self.assertEqual(before, self.snapshot())
        self.assertEqual(self.sql("SELECT to_regtype('public.user_role') IS NULL;").stdout.strip(), "t")

    def test_missing_column_rolls_back(self):
        self.legacy()
        self.sql("ALTER TABLE notifications DROP COLUMN status;")
        result = self.sql(MIGRATION, ok=False)
        self.assertIn("Missing public.notifications.status", result.stderr)
        self.assertEqual(self.sql("SELECT to_regtype('public.user_role') IS NULL;").stdout.strip(), "t")

    def test_incompatible_target_enum_rolls_back(self):
        self.legacy()
        self.sql("CREATE TYPE requirement_status AS ENUM ('OPEN', 'CLOSED');")
        result = self.sql(MIGRATION, ok=False)
        self.assertIn("unexpected labels", result.stderr)
        self.assertEqual(self.sql("SELECT to_regtype('public.user_role') IS NULL;").stdout.strip(), "t")

    def test_preserves_custom_blood_default(self):
        self.legacy()
        self.sql("ALTER TABLE donors ALTER COLUMN blood_group SET DEFAULT 'O_POS'::bloodgroup;")
        self.verify()
        self.sql("INSERT INTO profiles(id, full_name, email) VALUES "
                 "(md5('extra')::uuid, 'Extra', 'extra@example.invalid'); "
                 "INSERT INTO donors(profile_id) VALUES (md5('extra')::uuid);")
        self.assertEqual(self.sql("SELECT blood_group::text FROM donors WHERE profile_id = md5('extra')::uuid;").stdout.strip(), "O+")


if __name__ == "__main__":
    unittest.main(verbosity=2)
