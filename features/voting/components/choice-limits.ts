// The ballot's choice rules on screen (2026-11-18), the same as the voting
// core service checks (D017): Abstain stands alone, and a multiple-choice
// question takes at most max_choices answers. Used by the online ballot and
// by the admin's ballot preview. The server still checks.

const CHECKBOXES = 'input[type="checkbox"]';

function isAbstain(input: HTMLInputElement) {
  return input.dataset.abstain !== undefined;
}

/** Locks the unticked choices once the limit is reached, and unlocks them
 * again below it. Abstain stays free: ticking it clears the others. */
export function syncChoiceLimit(group: HTMLElement) {
  const max = Number(group.dataset.maxChoices || 0);
  const boxes = [...group.querySelectorAll<HTMLInputElement>(CHECKBOXES)];
  const count = boxes.filter((box) => box.checked && !isAbstain(box)).length;

  for (const box of boxes) {
    const lock = max > 0 && !box.checked && !isAbstain(box) && count >= max;

    if (lock && !box.disabled) {
      box.disabled = true;
      box.dataset.limitLocked = "";
    } else if (!lock && box.dataset.limitLocked !== undefined) {
      box.disabled = false;
      delete box.dataset.limitLocked;
    }
  }
}

/** Call from the form's change event. */
export function applyChoiceLimits(changed: EventTarget | null) {
  if (!(changed instanceof HTMLInputElement) || changed.type !== "checkbox") {
    return;
  }

  const group = changed.closest<HTMLElement>("[data-choice-group]");

  if (!group) {
    return;
  }

  if (changed.checked) {
    for (const box of group.querySelectorAll<HTMLInputElement>(CHECKBOXES)) {
      // Abstain clears the other answers; another answer clears Abstain.
      if (box !== changed && (isAbstain(changed) || isAbstain(box))) {
        box.checked = false;
      }
    }
  }

  syncChoiceLimit(group);
}

/** For a prefilled form, and after a reset. */
export function syncAllChoiceLimits(root: ParentNode) {
  root.querySelectorAll<HTMLElement>("[data-choice-group]").forEach(syncChoiceLimit);
}
