CREATE TABLE IF NOT EXISTS web_user_accounts (
    web_user_id INT REFERENCES web_users(id),
    account_id INT REFERENCES accounts(id),
    PRIMARY KEY(web_user_id, account_id)
);
