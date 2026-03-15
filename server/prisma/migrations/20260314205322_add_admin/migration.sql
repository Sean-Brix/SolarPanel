/*
  Warnings:

  - You are about to drop the `panel` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE IF EXISTS `panel`;
DROP TABLE IF EXISTS `Panel`;

-- CreateTable
CREATE TABLE `fixed_readings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `voltage` DOUBLE NOT NULL,
    `current` DOUBLE NOT NULL,
    `power` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conventional_readings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `voltage` DOUBLE NOT NULL,
    `current` DOUBLE NOT NULL,
    `power` DOUBLE NOT NULL,
    `axisX` DOUBLE NOT NULL,
    `axisY` DOUBLE NOT NULL,
    `axisZ` DOUBLE NOT NULL,
    `ldrTop` INTEGER NOT NULL,
    `ldrBottom` INTEGER NOT NULL,
    `ldrLeft` INTEGER NOT NULL,
    `ldrRight` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ann_readings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `voltage` DOUBLE NOT NULL,
    `current` DOUBLE NOT NULL,
    `power` DOUBLE NOT NULL,
    `axisX` DOUBLE NOT NULL,
    `axisY` DOUBLE NOT NULL,
    `axisZ` DOUBLE NOT NULL,
    `ldrTop` INTEGER NOT NULL,
    `ldrBottom` INTEGER NOT NULL,
    `ldrLeft` INTEGER NOT NULL,
    `ldrRight` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admins` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `admins_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
