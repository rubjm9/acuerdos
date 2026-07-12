"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/session";
import { withUser } from "@/lib/db";
import { audit } from "@/lib/audit";
import { ROLES } from "@/lib/domain";

const emailSchema = z.string().email().max(200);
const nameSchema = z.string().trim().min(2).max(200);
const uuidSchema = z.string().uuid();
const roleSchema = z.enum(Object.keys(ROLES) as [string, ...string[]]);

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function createUser(formData: FormData) {
  const admin = await requireAdmin();
  const email = emailSchema.parse(String(formData.get("email")).toLowerCase());
  const name = nameSchema.parse(formData.get("name"));
  const role = roleSchema.parse(formData.get("role"));
  await withUser(admin.id, async (c) => {
    const res = await c.query(
      "INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id",
      [email, name]
    );
    await c.query("INSERT INTO user_roles (user_id, role) VALUES ($1, $2)", [
      res.rows[0].id,
      role,
    ]);
    await audit(admin.id, "create", "user", res.rows[0].id, {
      metadata: { email, role },
      client: c,
    });
  });
  revalidatePath("/admin");
}

export async function toggleUserActive(formData: FormData) {
  const admin = await requireAdmin();
  const userId = uuidSchema.parse(formData.get("userId"));
  await withUser(admin.id, async (c) => {
    await c.query("UPDATE users SET is_active = NOT is_active WHERE id = $1", [userId]);
    await audit(admin.id, "update", "user", userId, {
      metadata: { field: "is_active" },
      client: c,
    });
  });
  revalidatePath("/admin");
}

export async function setUserRole(formData: FormData) {
  const admin = await requireAdmin();
  const userId = uuidSchema.parse(formData.get("userId"));
  const role = roleSchema.parse(formData.get("role"));
  await withUser(admin.id, async (c) => {
    await c.query("DELETE FROM user_roles WHERE user_id = $1", [userId]);
    await c.query("INSERT INTO user_roles (user_id, role) VALUES ($1, $2)", [userId, role]);
    await audit(admin.id, "update", "user", userId, { metadata: { role }, client: c });
  });
  revalidatePath("/admin");
}

export async function createArea(formData: FormData) {
  const admin = await requireAdmin();
  const name = nameSchema.parse(formData.get("name"));
  const isRestricted = formData.get("is_restricted") === "on";
  await withUser(admin.id, async (c) => {
    const res = await c.query(
      "INSERT INTO areas (name, slug, is_restricted) VALUES ($1, $2, $3) RETURNING id",
      [name, slugify(name), isRestricted]
    );
    await audit(admin.id, "create", "area", res.rows[0].id, {
      restricted: isRestricted,
      metadata: { name },
      client: c,
    });
  });
  revalidatePath("/admin");
}

export async function renameArea(formData: FormData) {
  const admin = await requireAdmin();
  const areaId = uuidSchema.parse(formData.get("areaId"));
  const name = nameSchema.parse(formData.get("name"));
  await withUser(admin.id, async (c) => {
    await c.query("UPDATE areas SET name = $2 WHERE id = $1", [areaId, name]);
    await audit(admin.id, "update", "area", areaId, { metadata: { name }, client: c });
  });
  revalidatePath("/admin");
}

export async function toggleAreaActive(formData: FormData) {
  const admin = await requireAdmin();
  const areaId = uuidSchema.parse(formData.get("areaId"));
  await withUser(admin.id, async (c) => {
    await c.query("UPDATE areas SET is_active = NOT is_active WHERE id = $1", [areaId]);
    await audit(admin.id, "update", "area", areaId, {
      metadata: { field: "is_active" },
      client: c,
    });
  });
  revalidatePath("/admin");
}

export async function grantAreaAccess(formData: FormData) {
  const admin = await requireAdmin();
  const userId = uuidSchema.parse(formData.get("userId"));
  const areaId = uuidSchema.parse(formData.get("areaId"));
  const canEdit = formData.get("can_edit") === "on";
  await withUser(admin.id, async (c) => {
    await c.query(
      `INSERT INTO user_area_access (user_id, area_id, can_view, can_edit)
       VALUES ($1, $2, true, $3)
       ON CONFLICT (user_id, area_id) DO UPDATE SET can_view = true, can_edit = $3`,
      [userId, areaId, canEdit]
    );
    await audit(admin.id, "update", "user_area_access", `${userId}:${areaId}`, {
      restricted: true,
      metadata: { granted: true, can_edit: canEdit },
      client: c,
    });
  });
  revalidatePath("/admin");
}

export async function revokeAreaAccess(formData: FormData) {
  const admin = await requireAdmin();
  const userId = uuidSchema.parse(formData.get("userId"));
  const areaId = uuidSchema.parse(formData.get("areaId"));
  await withUser(admin.id, async (c) => {
    await c.query("DELETE FROM user_area_access WHERE user_id = $1 AND area_id = $2", [
      userId,
      areaId,
    ]);
    await audit(admin.id, "update", "user_area_access", `${userId}:${areaId}`, {
      restricted: true,
      metadata: { granted: false },
      client: c,
    });
  });
  revalidatePath("/admin");
}

export async function createCommittee(formData: FormData) {
  const admin = await requireAdmin();
  const name = nameSchema.parse(formData.get("name"));
  const areaId = formData.get("areaId") ? uuidSchema.parse(formData.get("areaId")) : null;
  await withUser(admin.id, async (c) => {
    const res = await c.query(
      "INSERT INTO committees (name, area_id) VALUES ($1, $2) RETURNING id",
      [name, areaId]
    );
    await audit(admin.id, "create", "committee", res.rows[0].id, {
      metadata: { name },
      client: c,
    });
  });
  revalidatePath("/admin");
}

export async function setCommitteeMembers(formData: FormData) {
  const admin = await requireAdmin();
  const committeeId = uuidSchema.parse(formData.get("committeeId"));
  const memberIds = formData
    .getAll("memberIds")
    .map((v) => uuidSchema.parse(v));
  await withUser(admin.id, async (c) => {
    await c.query("DELETE FROM committee_members WHERE committee_id = $1", [committeeId]);
    for (const uid of memberIds) {
      await c.query(
        "INSERT INTO committee_members (committee_id, user_id) VALUES ($1, $2)",
        [committeeId, uid]
      );
    }
    await audit(admin.id, "update", "committee", committeeId, {
      metadata: { members: memberIds.length },
      client: c,
    });
  });
  revalidatePath("/admin");
}
