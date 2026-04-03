CREATE TABLE `ann_prediction_runs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `deviceId` VARCHAR(191) NOT NULL,
    `predictionId` INTEGER NULL,
    `verifiedId` INTEGER NULL,
    `deviceTimestamp` DATETIME(3) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `mode` VARCHAR(191) NOT NULL,
    `overallResult` VARCHAR(191) NOT NULL,
    `sensorResult` VARCHAR(191) NOT NULL,
    `weatherCodeResult` VARCHAR(191) NOT NULL,
    `timeResult` VARCHAR(191) NOT NULL,
    `tempResult` VARCHAR(191) NOT NULL,
    `humidityResult` VARCHAR(191) NOT NULL,
    `weatherMatchCount` INTEGER NOT NULL DEFAULT 0,
    `weatherCheckCount` INTEGER NOT NULL DEFAULT 4,
    `fieldCount` INTEGER NOT NULL DEFAULT 0,
    `okCount` INTEGER NOT NULL DEFAULT 0,
    `mismatchCount` INTEGER NOT NULL DEFAULT 0,
    `worstFieldName` VARCHAR(191) NULL,
    `worstFieldDifference` DOUBLE NULL,
    `worstFieldTolerance` DOUBLE NULL,
    `worstFieldDiffRatio` DOUBLE NULL,
    `relayApplied` BOOLEAN NOT NULL DEFAULT false,
    `relayMessage` VARCHAR(191) NULL,
    `weather` JSON NOT NULL,
    `samples` JSON NOT NULL,
    `predictionCheck` JSON NOT NULL,
    `relayMemory` JSON NOT NULL,
    `fieldResults` JSON NOT NULL,
    `rawPayload` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `ann_prediction_runs_deviceTimestamp_idx` ON `ann_prediction_runs`(`deviceTimestamp` DESC);
CREATE INDEX `ann_prediction_runs_overallResult_deviceTimestamp_idx` ON `ann_prediction_runs`(`overallResult`, `deviceTimestamp` DESC);
CREATE INDEX `ann_prediction_runs_sensorResult_deviceTimestamp_idx` ON `ann_prediction_runs`(`sensorResult`, `deviceTimestamp` DESC);
CREATE INDEX `ann_prediction_runs_relayApplied_deviceTimestamp_idx` ON `ann_prediction_runs`(`relayApplied`, `deviceTimestamp` DESC);
