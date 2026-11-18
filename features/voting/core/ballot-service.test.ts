import { describe, expect, it } from "vitest";
import { answersFromFormData } from "@/features/voting/core/ballot-service";

describe("answersFromFormData", () => {
  it("adds a trimmed comment to the answer of its question (0040)", () => {
    const form = new FormData();
    form.append("choice:q1", "c1");
    form.append("comment:q1", "  Please share the quotes.  ");
    form.append("choice:q2", "c2");
    form.append("comment:q2", "   ");

    expect(answersFromFormData(form)).toEqual([
      { question_id: "q1", choice_ids: ["c1"], comment: "Please share the quotes." },
      { question_id: "q2", choice_ids: ["c2"] },
    ]);
  });

  it("ignores a comment without an answer", () => {
    const form = new FormData();
    form.append("comment:q1", "Only a comment");

    expect(answersFromFormData(form)).toEqual([]);
  });
});
