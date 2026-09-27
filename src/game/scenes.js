// Cutscene pages. `stage.shot(...)` renders the live city from a posed camera into a panel image.
import MANSI from '../mansi.config.js';
import { jokerTV, jokerCard, titleCard } from '../ui/comicArt.js';

const J = (text, x = 50, y = 5, extra = {}) => ({ text, x, y, joker: true, ...extra });

export const SCENES = {
  intro: (stage) => [
    {
      panels: [
        { span: 'wide', img: stage.shot({ cam: [34, 74, 70], look: [-30, 30, -70] }), caption: 'Gotham City. Another night of rain.' },
        { img: stage.shot({ cam: [-5, 44.2, -2], look: [-12, 43.6, -12], hero: null }), caption: 'The Batsignal is lit. Somebody wants attention.', captionPos: 'bottom' },
        { img: jokerTV('grin'), balloons: [J(`Good evening, Gotham! And a very happy birthday to ${MANSI.name.toUpperCase()}!`, 50, 5, { w: 80 })] },
        { span: 'wide', img: jokerTV('smug'), balloons: [J('I borrowed the cake, the presents and the whole party. Come and get them, if you can! HA HA HA!', 50, 5, { w: 70 })] },
      ],
    },
    {
      layout: 'single',
      panels: [{ span: 'full', img: stage.shot({ cam: [3.2, 42.8, 23], look: [-4, 47, 8], fov: 50, hero: { at: [0.5, 42, 17.5], yaw: -2.7, anim: 'Idle_Loop' } }), caption: `Gotham needs you, ${MANSI.name}.`, captionPos: 'bottom' }],
    },
  ],

  card: (stage) => [
    {
      layout: 'duo',
      panels: [
        { img: stage.shot({ cam: [-5.6, 44.8, -5.2], look: [-12, 43.4, -12], hero: { at: [-9.4, 42, -8.2], yaw: -2.35, anim: 'Interact' } }), caption: 'A playing card, taped to the lamp.' },
        { img: jokerCard() },
      ],
    },
  ],

  presents: (stage) => [
    {
      layout: 'duo',
      panels: [
        { img: stage.shot({ cam: [-40.5, 10.9, 236.5], look: [-44, 9.7, 232], hero: { at: [-42.6, 9, 233.6], yaw: -2.4, anim: 'Yes' } }), caption: 'The presents: recovered. Every bow still tied.' },
        { img: jokerTV('smug'), balloons: [J('Lucky break, birthday bat! But you will never find the PARTY. It is somewhere very... neon.', 50, 5, { w: 78 })] },
      ],
    },
  ],

  party: (stage) => [
    {
      layout: 'trio',
      panels: [
        { img: stage.shot({ cam: [182.5, 24.2, -58], look: [186, 22.9, -66], hero: { at: [184.4, 22, -62.5], yaw: 2.9, anim: 'Dance_Loop', time: 1.2 } }), caption: 'The party is back on.' },
        { img: stage.shot({ cam: [150, 2.5, 24], look: [150, 9, 62] }), caption: 'Neon Row lights up again.', captionPos: 'bottom' },
        { img: jokerTV('angry'), balloons: [J('Fine, keep the disco ball! The CAKE stays with me!', 50, 5, { w: 80 })] },
      ],
    },
  ],

  cake: (stage) => [
    {
      layout: 'duo',
      panels: [
        { img: stage.shot({ cam: [180.8, 11.6, -107.6], look: [184, 10.8, -112], hero: { at: [182, 10, -109.8], yaw: 2.4, anim: 'Yes' } }), caption: 'The cake survived. Barely.' },
        { img: jokerTV('angry'), balloons: [J('ENOUGH! The clock tower. Midnight. Let us finish this with a BANG!', 50, 5, { w: 78 })] },
      ],
    },
  ],

  death: () => [
    { layout: 'single', panels: [{ span: 'full', img: titleCard('GET UP!', `Gotham is still waiting, ${MANSI.name}.`) }] },
  ],
};
