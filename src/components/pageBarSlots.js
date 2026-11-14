// v1.10.86 - one line at the top of every screen (maintainer, 15 Nov: "all
// things in one in top bar"). App.jsx owns the top bar and puts two empty
// boxes in it; each screen's PageHeader fills them through a portal:
// { title, actions } are those two elements (null until the bar has mounted).
import { createContext } from 'react';

export const PageBarSlots = createContext(null);

// The steps the bar takes, in order, while its contents are wider than it:
// the search box becomes a search icon, then the screen's icon buttons go
// into a "⋯" menu, then the title's own controls take a second line beside
// the buttons, and only then may the whole bar wrap.
const STEPS = ['fit-search-icon', 'fit-more', 'fit-wrap', 'fit-wrap-all'];

export function fitPageBar(bar) {
  if (!bar) return;
  bar.classList.remove(...STEPS);
  // A phone has its own top bar (search and icons); this row keeps the title
  // and the main button, the other buttons are always in the ⋯ menu.
  let from = 0;
  if (window.matchMedia('(max-width: 768px)').matches) {
    bar.classList.add(STEPS[0], STEPS[1]);
    from = 2;
  }
  for (const step of STEPS.slice(from)) {
    if (bar.scrollWidth <= bar.clientWidth + 1) return;
    bar.classList.add(step);
  }
}
