-- CreateTable
CREATE TABLE `mobile_push_tokens` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `userId` INTEGER NOT NULL,
  `platform` VARCHAR(20) NOT NULL,
  `token` VARCHAR(512) NOT NULL,
  `appVersion` VARCHAR(30) NOT NULL,
  `deviceId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `mobile_push_tokens_userId_platform_idx`(`userId`, `platform`),
  INDEX `mobile_push_tokens_token_idx`(`token`),
  UNIQUE INDEX `mobile_push_tokens_userId_platform_token_key`(`userId`, `platform`, `token`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `mobile_push_tokens`
ADD CONSTRAINT `mobile_push_tokens_userId_fkey`
FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;
