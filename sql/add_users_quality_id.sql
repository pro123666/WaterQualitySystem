-- 在 MySQL 中为 users 表增加 quality_id（与 models.py 一致）
-- 在 Navicat / MySQL Workbench / 命令行中执行本文件，库名请改为你的库（默认 water_quality）
-- USE water_quality;

-- 若已存在该列会报错 1060，可忽略或先检查：
-- SHOW COLUMNS FROM users LIKE 'quality_id';

ALTER TABLE `users`
  ADD COLUMN `quality_id` INT NULL COMMENT '关联 quality.id';

ALTER TABLE `users`
  ADD CONSTRAINT `fk_users_quality_id_quality`
  FOREIGN KEY (`quality_id`) REFERENCES `quality`(`id`)
  ON DELETE SET NULL;
