import jwt from "jsonwebtoken";

const TYP = "progressShare";

export function signProgressShareToken(batchId: number, playerId: number): string {
  const secret = process.env.JWT_SECRET ?? "dev-only-change-in-prod";
  return jwt.sign({ typ: TYP, batchId, playerId }, secret, { expiresIn: "30d" });
}

export function verifyProgressShareToken(token: string): { batchId: number; playerId: number } | null {
  try {
    const secret = process.env.JWT_SECRET ?? "dev-only-change-in-prod";
    const p = jwt.verify(token, secret) as jwt.JwtPayload & {
      typ?: string;
      batchId?: number;
      playerId?: number;
    };
    if (p.typ !== TYP || typeof p.batchId !== "number" || typeof p.playerId !== "number") return null;
    return { batchId: p.batchId, playerId: p.playerId };
  } catch {
    return null;
  }
}
