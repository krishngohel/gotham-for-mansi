// Cutscene pages. `stage.shot(...)` renders the live city from a posed camera into a panel image.
import MANSI from '../mansi.config.js';
import { jokerTV, jokerCard, titleCard } from '../ui/comicArt.js';

const J = (text, x = 50, y = 5, extra = {}) => ({ text, x, y, joker: true, ...extra });

export const SCENES = {
  intro: (stage) => [
    {
      panels: [
        { span: 'wide', img: stage.shot({ cam: [34, 74, 70], look: [-30, 30, -70] }), caption: `Gotham City, midnight. Commissioner Gordon promised ${MANSI.name} a citywide birthday.` },
        { img: stage.shot({ cam: [-5, 44.2, -2], look: [-12, 43.6, -12], hero: null }), caption: 'Then the Batsignal flickers, and the light on the clouds is not a bat anymore. It is a cake.', captionPos: 'bottom' },
        { voice: 'intro1', img: jokerTV('grin'), balloons: [J(`Good evening, Gotham! And a very happy birthday to the birthday girl herself, ${MANSI.name.toUpperCase()}!`, 50, 5, { w: 80 })] },
        { voice: 'intro2', span: 'wide', img: jokerTV('smug'), balloons: [J('I borrowed the cake, the presents and the whole party. Come and get them, if you can! HA HA HA!', 50, 5, { w: 70 })] },
      ],
    },
    {
      layout: 'single',
      panels: [{ span: 'full', img: stage.shot({ cam: [3.2, 42.8, 23], look: [-4, 47, 8], fov: 50, hero: { at: [0.5, 42, 17.5], yaw: -2.7, anim: 'Idle_Loop' } }), caption: `Gotham needs you, ${MANSI.name}. Happy birthday. Now go get your party back.`, captionPos: 'bottom' }],
    },
  ],

  // Act title cards: a plain, big comic panel between chapters, reusing titleCard().
  actOne: () => [{ layout: 'single', panels: [{ span: 'full', img: titleCard('ACT ONE: THE PARTY IS STOLEN', 'The Docks and Neon Row') }] }],
  actTwo: () => [{ layout: 'single', panels: [{ span: 'full', img: titleCard('ACT TWO: ACE CHEMICALS', 'Follow the smell of frosting') }] }],
  actThree: () => [{ layout: 'single', panels: [{ span: 'full', img: titleCard('ACT THREE: THE CLOCK PLAZA', 'Balloons, a funhouse, and the Joker') }] }],

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
        { voice: 'presents', img: jokerTV('smug'), balloons: [J('Lucky break, birthday bat! But you will never find the PARTY. It is somewhere very... neon.', 50, 5, { w: 78 })] },
      ],
    },
  ],

  party: (stage) => [
    {
      layout: 'trio',
      panels: [
        { img: stage.shot({ cam: [182.5, 24.2, -58], look: [186, 22.9, -66], hero: { at: [184.4, 22, -62.5], yaw: 2.9, anim: 'Dance_Loop', time: 1.2 } }), caption: 'The party is back on.' },
        { img: stage.shot({ cam: [150, 2.5, 24], look: [150, 9, 62] }), caption: 'Neon Row lights up again.', captionPos: 'bottom' },
        { voice: 'party', img: jokerTV('angry'), balloons: [J('Fine, keep the disco ball! The CAKE stays with me!', 50, 5, { w: 80 })] },
      ],
    },
  ],

  cake: (stage) => [
    {
      layout: 'duo',
      panels: [
        { img: stage.shot({ cam: [180.8, 11.6, -107.6], look: [184, 10.8, -112], hero: { at: [182, 10, -109.8], yaw: 2.4, anim: 'Yes' } }), caption: 'The cake survived. Barely.' },
        { voice: 'cake', img: jokerTV('angry'), balloons: [J('ENOUGH! The clock tower. Midnight. Let us finish this with a BANG!', 50, 5, { w: 78 })] },
      ],
    },
  ],

  bossIntro: (stage) => [
    {
      layout: 'duo',
      panels: [
        { img: stage.shot({ cam: [-66, 70.4, -153.5], look: [-62, 68.8, -162], fov: 50, hero: { at: [-63.5, 58, -148], yaw: Math.PI, anim: 'Idle_Loop' }, setup: (s) => s.boss.pose([-62, 68, -161.7], 0, 'Idle_Rail_Call', 0.8) }), caption: 'The clock tower. One minute to midnight.' },
        { img: stage.shot({ cam: [-60.2, 69.4, -160], look: [-62, 69.2, -163.5], hero: null, setup: (s) => s.boss.pose([-62, 68, -161.7], 0.3, 'Idle_Rail_Call', 1.4) }), voice: 'bossIntro', balloons: [J('Welcome to my party, birthday bat! Games first. Cake never. HA HA HA!', 50, 5, { w: 80 })] },
      ],
    },
  ],

  bossEnd: (stage) => [
    {
      layout: 'duo',
      panels: [
        { img: stage.shot({ cam: [-58, 59.8, -146], look: [-62, 58.4, -152], hero: { at: [-61, 58, -149.5], yaw: Math.PI, anim: 'Idle_Loop' }, setup: (s) => s.boss.pose([-62, 58, -153.5], 0, 'Death01', 3) }), caption: 'The Joker is done laughing. For tonight.' },
        { voice: 'bossEnd', img: jokerTV('smug'), balloons: [J(`Okay, okay, you win! The cake is safe, the party is back, and... happy birthday, ${MANSI.name}. I mean it. Mostly.`, 50, 5, { w: 84 })] },
      ],
    },
  ],

  death: () => [
    { layout: 'single', panels: [{ span: 'full', img: titleCard('GET UP!', `Gotham is still waiting, ${MANSI.name}.`) }] },
  ],
};
