import prisma from "../lib/prisma";

export type MobilePlatform = "ios" | "android";

export interface RegisterMobilePushTokenInput {
  userId: number;
  platform: MobilePlatform;
  token: string;
  appVersion: string;
  deviceId?: string;
}

/**
 * Registers or refreshes a mobile push token for a user.
 * Existing entries are matched by (userId, platform, token) first, then by
 * deviceId when available so token rotations on the same device do not create
 * stale rows.
 */
export async function registerMobilePushToken(input: RegisterMobilePushTokenInput): Promise<void> {
  const mobilePushToken = (prisma as any).mobilePushToken;
  if (!mobilePushToken) {
    throw new Error("Mobile push token storage is not available in Prisma client");
  }

  const existingByToken = await mobilePushToken.findFirst({
    where: {
      userId: input.userId,
      platform: input.platform,
      token: input.token,
    },
    select: { id: true },
  });

  if (existingByToken) {
    await mobilePushToken.update({
      where: { id: existingByToken.id },
      data: {
        appVersion: input.appVersion,
        deviceId: input.deviceId ?? null,
      },
    });
    return;
  }

  if (input.deviceId) {
    const existingByDevice = await mobilePushToken.findFirst({
      where: {
        userId: input.userId,
        platform: input.platform,
        deviceId: input.deviceId,
      },
      select: { id: true },
    });

    if (existingByDevice) {
      await mobilePushToken.update({
        where: { id: existingByDevice.id },
        data: {
          token: input.token,
          appVersion: input.appVersion,
          deviceId: input.deviceId,
        },
      });
      return;
    }
  }

  await mobilePushToken.create({
    data: {
      userId: input.userId,
      platform: input.platform,
      token: input.token,
      appVersion: input.appVersion,
      deviceId: input.deviceId ?? null,
    },
  });
}
