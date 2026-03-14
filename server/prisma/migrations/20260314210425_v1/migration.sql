-- RedefineIndex
CREATE UNIQUE INDEX `admins_username_key` ON `admins`(`email`);
DROP INDEX `admins_email_key` ON `admins`;
