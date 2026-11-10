# Resolution Rules

How a result snapshot decides each question and the meeting quorum (D013).
Code: `features/results/pass-rules.ts`, tested in `pass-rules.test.ts`.
Legal presets still need lawyer confirmation; see [compliance.md](compliance.md).

## Inputs
- **Total ownership**: sum of `ownership_percent` of every room in the
  meeting's `eligible_voters_snapshot`.
- **Voting ownership**: sum of ownership of rooms with an effective ballot
  (online or manual, after conflict resolution). Rooms that chose Abstain
  count as voting.
- **Choice ownership**: sum of ownership of rooms that selected the choice.

## Pass Rule Per Question
Each question stores a rule: basis, comparison, and percent.

| Preset (`required_threshold`) | Basis | Comparison | Percent |
| --- | --- | --- | --- |
| `majority_submitted` | voting ownership | more than | 50 |
| `half_total` | total ownership | more than | 50 |
| `one_third_total` | total ownership | at least | 33.33 |
| `three_fourths_total` | total ownership | at least | 75 |
| `informational` | none | - | - |
| `custom` | set by admin | set by admin | set by admin |

A choice **meets the rule** when its ownership, as a percentage of the basis,
passes the comparison. Abstain never meets the rule.

## Outcome
- **Single choice**: decided when exactly one non-abstain choice meets the
  rule; that choice is the decision. Otherwise not decided.
- **Multiple choice**: every choice is checked on its own. Decided when at
  least one choice meets the rule; all choices that meet it are listed.
- **Informational**: no outcome.

## Quorum
`meetings.quorum_rule` sets the quorum. `one_fourth_total_ownership` is met
when voting ownership is at least 25% of total ownership. The snapshot
records the quorum but does not change question outcomes; the meeting chair
decides what an unmet quorum means for the meeting.

## Worked Example
Total ownership 100. Rooms that voted: 60 (Yes 31, No 20, Abstain 9).

| Rule | Yes as % of basis | Result |
| --- | --- | --- |
| More than 50% of voting ownership | 31 / 60 = 51.67% | Decided: Yes |
| More than 50% of total ownership | 31 / 100 = 31% | Not decided |
| At least 30% of voting ownership | Yes 51.67%, No 33.33% | Not decided (two choices meet it) |

Quorum (1/4 of total): 60 / 100 = 60% ≥ 25%, met.
