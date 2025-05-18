CREATE TABLE admin_logs (
    id integer,
    username text,
    success boolean,
    ip text,
    timestamp timestamp without time zone
);

CREATE TABLE admin_users (
    username text,
    password_hash text
);

CREATE TABLE score_snake (
    id integer,
    user_id integer,
    username character varying,
    niveau integer,
    score integer,
    temps integer,
    date_partie timestamp without time zone
);

CREATE TABLE scores (
    id integer,
    user_id integer,
    value integer,
    date timestamp without time zone
);

CREATE TABLE sessions (
    id uuid,
    user_id integer,
    created_at timestamp without time zone
);

CREATE TABLE space_scores (
    id integer,
    user_id integer,
    score integer,
    level integer,
    xp integer,
    wave integer,
    created_at timestamp without time zone,
    duration integer
);

CREATE TABLE space_telemetry (
    id integer,
    user_id integer,
    event text,
    wave integer,
    score integer,
    combo integer,
    lives integer,
    created_at timestamp without time zone
);

CREATE TABLE tetris_scores (
    id integer,
    user_id integer,
    score integer,
    created_at timestamp without time zone
);

CREATE TABLE user_ips (
    id integer,
    user_id integer,
    ip_address character varying,
    location text,
    timestamp timestamp without time zone
);

CREATE TABLE users (
    id integer,
    nom character varying,
    prenom character varying,
    username character varying,
    email character varying,
    password text,
    is_active boolean,
    city character varying,
    country character varying,
    languages character varying,
    birthdate date,
    registration_ip character varying,
    elo integer,
    avatar character varying
);
