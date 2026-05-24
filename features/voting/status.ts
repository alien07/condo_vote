export type VotingWindowStatus = {
  label: "Not open yet" | "Open" | "Closed" | "Unavailable";
  canSubmit: boolean;
};

export function getVotingWindowStatus(meeting: {
  status: string;
  starts_at: string;
  ends_at: string;
} | null): VotingWindowStatus {
  if (!meeting || meeting.status !== "published") {
    return {
      label: "Unavailable",
      canSubmit: false,
    };
  }

  const now = new Date();

  if (now < new Date(meeting.starts_at)) {
    return {
      label: "Not open yet",
      canSubmit: false,
    };
  }

  if (now > new Date(meeting.ends_at)) {
    return {
      label: "Closed",
      canSubmit: false,
    };
  }

  return {
    label: "Open",
    canSubmit: true,
  };
}
