
export function encodeManualVotePart(value: string) {
  return encodeURIComponent(value);
}

export type ProxyActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  recordId?: string;
  success?: string;
  values?: Record<string, string>;
};

export type ManualVoteActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  recordId?: string;
  redirectHref?: string;
  success?: string;
  values?: Record<string, string>;
};

export type VoteSourceConflictActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  recordKey?: string;
  success?: string;
  values?: Record<string, string>;
};

export function proxyFormValues(formData: FormData) {
  return Object.fromEntries(
    [
      "id",
      "meeting_id",
      "room_id",
      "owner_id",
      "proxy_profile_id",
      "valid_from",
      "valid_until",
      "status",
    ].map((field) => [field, String(formData.get(field) ?? "")]),
  );
}

export function manualVoteImportValues(formData: FormData) {
  return Object.fromEntries(
    ["meeting_id", "room_id", "voter_profile_id", "voter_identity_text"].map(
      (field) => [field, String(formData.get(field) ?? "")],
    ),
  );
}

export function manualVoteIdentityValues(formData: FormData) {
  return Object.fromEntries(
    ["id", "voter_profile_id"].map((field) => [
      field,
      String(formData.get(field) ?? ""),
    ]),
  );
}

export function manualVoteValidationState(
  fieldErrors: Record<string, string>,
  values: Record<string, string>,
): ManualVoteActionState | null {
  const count = Object.keys(fieldErrors).length;

  if (count === 0) {
    return null;
  }

  return {
    error: `Please fix ${count} field${count === 1 ? "" : "s"} before saving.`,
    fieldErrors,
    values,
  };
}

export function validateManualVoteImport(values: Record<string, string>) {
  const fieldErrors: Record<string, string> = {};

  if (!values.meeting_id?.trim()) {
    fieldErrors.meeting_id = "Meeting is required.";
  }

  if (!values.room_id?.trim()) {
    fieldErrors.room_id = "Room is required.";
  }

  if (!values.voter_profile_id?.trim() && !values.voter_identity_text?.trim()) {
    fieldErrors.voter_profile_id =
      "Voter profile or pending voter identity is required.";
    fieldErrors.voter_identity_text =
      "Voter profile or pending voter identity is required.";
  }

  return fieldErrors;
}

export function validateManualVoteIdentity(values: Record<string, string>) {
  const fieldErrors: Record<string, string> = {};

  if (!values.id?.trim()) {
    fieldErrors.id = "Manual ballot is required.";
  }

  if (!values.voter_profile_id?.trim()) {
    fieldErrors.voter_profile_id = "Voter profile is required.";
  }

  return fieldErrors;
}

export function validateProxyCreate(values: Record<string, string>) {
  const fieldErrors: Record<string, string> = {};

  (
    [
      ["meeting_id", "Meeting"],
      ["room_id", "Room"],
      ["proxy_profile_id", "Proxy profile"],
    ] as const
  ).forEach(([field, label]) => {
    if (!values[field]?.trim()) {
      fieldErrors[field] = `${label} is required.`;
    }
  });

  return fieldErrors;
}

export function validateProxyReview(values: Record<string, string>) {
  const fieldErrors: Record<string, string> = {};
  const allowedStatuses = ["pending", "approved", "rejected", "revoked"];

  if (!values.id?.trim()) {
    fieldErrors.id = "Proxy authorization ID is required.";
  }

  if (!values.status?.trim()) {
    fieldErrors.status = "Status is required.";
  } else if (!allowedStatuses.includes(values.status)) {
    fieldErrors.status = "Status is not supported.";
  }

  return fieldErrors;
}

export function proxyValidationState(
  fieldErrors: Record<string, string>,
  values: Record<string, string>,
): ProxyActionState | null {
  const count = Object.keys(fieldErrors).length;

  if (count === 0) {
    return null;
  }

  return {
    error: `Please fix ${count} field${count === 1 ? "" : "s"} before saving.`,
    fieldErrors,
    values,
  };
}
