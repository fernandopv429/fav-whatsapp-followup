import { createHash, scryptSync, timingSafeEqual } from "crypto";

/** Hash de senha com salt fixo por instância (uso single-user, sem cadastro). */
export function hashPassword(password: string): string {
  return scryptSync(password, "fav-whatsapp-followup-salt", 64).toString("hex");
}

export function verifyCredentials(user: string, password: string): boolean {
  const expectedUser = process.env.ADMIN_USER ?? "";
  const expectedHash = process.env.ADMIN_PASSWORD_HASH ?? "";
  if (!expectedUser || !expectedHash) return false;

  const userOk = timingSafeEqual(
    Buffer.from(createHash("sha256").update(user).digest("hex")),
    Buffer.from(createHash("sha256").update(expectedUser).digest("hex"))
  );

  const providedHash = hashPassword(password);
  const passOk =
    providedHash.length === expectedHash.length &&
    timingSafeEqual(Buffer.from(providedHash), Buffer.from(expectedHash));

  return userOk && passOk;
}
