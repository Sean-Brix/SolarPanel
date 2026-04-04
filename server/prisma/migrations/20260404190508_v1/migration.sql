-- CreateIndex
CREATE INDEX `ann_prediction_runs_createdAt_id_idx` ON `ann_prediction_runs`(`createdAt` DESC, `id` DESC);

-- CreateIndex
CREATE INDEX `ann_prediction_runs_overallResult_createdAt_idx` ON `ann_prediction_runs`(`overallResult`, `createdAt` DESC);

-- CreateIndex
CREATE INDEX `ann_prediction_runs_sensorResult_createdAt_idx` ON `ann_prediction_runs`(`sensorResult`, `createdAt` DESC);

-- CreateIndex
CREATE INDEX `ann_prediction_runs_relayApplied_createdAt_idx` ON `ann_prediction_runs`(`relayApplied`, `createdAt` DESC);

-- CreateIndex
CREATE INDEX `conventional_readings_createdAt_id_idx` ON `conventional_readings`(`createdAt` DESC, `id` DESC);

-- CreateIndex
CREATE INDEX `fixed_readings_createdAt_id_idx` ON `fixed_readings`(`createdAt` DESC, `id` DESC);
