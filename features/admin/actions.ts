"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function requiredText(value: FormDataEntryValue | null, fieldName: string) {
  const text = optionalText(value);

  if (!text) {
    throw new Error(`${fieldName} is required.`);
  }

  return text;
}

function optionalNumber(value: FormDataEntryValue | null) {
  const text = optionalText(value);
  return text ? Number(text) : null;
}

function requiredNumber(value: FormDataEntryValue | null, fieldName: string) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${fieldName} must be greater than 0.`);
  }

  return number;
}

export async function createRoom(formData: FormData) {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("rooms").insert({
    room_number: requiredText(formData.get("room_number"), "Room number"),
    floor: optionalText(formData.get("floor")),
    building: optionalText(formData.get("building")),
    area_size: optionalNumber(formData.get("area_size")),
    ownership_percent: requiredNumber(
      formData.get("ownership_percent"),
      "Ownership percentage",
    ),
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin");
}

export async function deactivateRoom(formData: FormData) {
  await requireAdmin();

  const id = requiredText(formData.get("id"), "Room ID");
  const supabase = await createClient();
  const { error } = await supabase
    .from("rooms")
    .update({ active: false })
    .eq("id", id);

  if (error) {
    throw error;
  }

  revalidatePath("/admin");
}

export async function createOwner(formData: FormData) {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("owners").insert({
    full_name: requiredText(formData.get("full_name"), "Full name"),
    email: optionalText(formData.get("email")),
    phone: optionalText(formData.get("phone")),
    line_id: optionalText(formData.get("line_id")),
  });

  if (error) {
    throw error;
  }

  revalidatePath("/admin");
}

export async function deactivateOwner(formData: FormData) {
  await requireAdmin();

  const id = requiredText(formData.get("id"), "Owner ID");
  const supabase = await createClient();
  const { error } = await supabase
    .from("owners")
    .update({ active: false })
    .eq("id", id);

  if (error) {
    throw error;
  }

  revalidatePath("/admin");
}
