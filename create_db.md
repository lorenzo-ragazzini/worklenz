sudo -u postgres psql

SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='worklenz_db' AND pid<>pg_backend_pid();
DROP DATABASE IF EXISTS worklenz_db
CREATE DATABASE worklenz_db

DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='worklenz_user') THEN
      CREATE ROLE worklenz_user WITH LOGIN PASSWORD 'worklenz';
   ELSE
      ALTER ROLE worklenz_user WITH LOGIN PASSWORD 'worklenz';
   END IF;
END
$$;

GRANT ALL PRIVILEGES ON DATABASE worklenz_db TO worklenz_user;

\c worklenz_db

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO worklenz_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO worklenz_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO worklenz_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO worklenz_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO worklenz_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO worklenz_user;

\dt
\du worklenz_user
