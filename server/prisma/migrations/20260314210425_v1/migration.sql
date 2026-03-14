-- RedefineIndex
CREATE UNIQUE INDEX `admins_username_key` ON `admins`(`username`);
DROP INDEX `admins_email_key` ON `admins`;
