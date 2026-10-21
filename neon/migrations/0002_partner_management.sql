alter type partner_type add value if not exists 'lainnya';

alter table users add column if not exists username text;
create unique index if not exists users_username_unique on users (username);
