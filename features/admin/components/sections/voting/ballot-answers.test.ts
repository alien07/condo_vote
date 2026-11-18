import { describe, expect, it } from "vitest";
import { ballotAnswers } from "@/features/admin/components/sections/voting/ballot-answers";

const question = (order: number, text: string, agendaNo: string | null = String(order)) => ({
  question_text: text,
  agenda_no: agendaNo,
  display_order: order,
});
const choice = (order: number, text: string) => ({ choice_text: text, display_order: order });

describe("ballotAnswers", () => {
  it("gives one line per agenda item, in agenda order", () => {
    const lines = ballotAnswers([
      { question_id: "q3", meeting_questions: question(3, "Budget"), meeting_choices: choice(1, "Approve") },
      { question_id: "q1", meeting_questions: question(1, "Minutes"), meeting_choices: choice(2, "Reject") },
    ]);

    expect(lines.map((line) => line.question)).toEqual(["1. Minutes", "3. Budget"]);
  });

  it("joins the choices of a multiple-choice item, in choice order", () => {
    const lines = ballotAnswers([
      { question_id: "q2", meeting_questions: question(2, "Committee"), meeting_choices: choice(3, "C") },
      { question_id: "q2", meeting_questions: question(2, "Committee"), meeting_choices: choice(1, "A") },
    ]);

    expect(lines).toEqual([{ questionId: "q2", question: "2. Committee", choices: "A, C" }]);
  });

  it("returns nothing for a ballot without answers", () => {
    expect(ballotAnswers([])).toEqual([]);
  });
});
