// The two reward comic pages: gold in every challenge, and 100% on the Progress page.
import MANSI from '../mansi.config.js';
import { titleCard } from '../ui/comicArt.js';

export function goldStandardPages(stage) {
  return [{
    layout: 'duo',
    panels: [
      { img: titleCard(`${MANSI.name.toUpperCase()}'S GOLD STANDARD`, 'Every challenge. Every gold.') },
      {
        img: stage.shot({ cam: [3.2, 42.8, 23], look: [-4, 47, 8], fov: 50, hero: { at: [0.5, 42, 17.5], yaw: -2.7, anim: 'Yes' } }),
        caption: 'Fastest wings in Gotham. Hardest hands, too. Nobody else comes close.', captionPos: 'bottom',
      },
    ],
  }];
}

export function fromKrishnPages(stage) {
  return [
    { layout: 'single', panels: [{ span: 'full', img: titleCard(`FROM ${MANSI.fromName.toUpperCase()}`, 'One hundred percent.') }] },
    {
      layout: 'single',
      panels: [{ span: 'full', img: stage.shot({ cam: [34, 74, 70], look: [-30, 30, -70] }), caption: MANSI.completionMessage, captionPos: 'bottom' }],
    },
  ];
}
