import { Component } from '@theme/component';

const AUTOPLAY_INTERVAL_MS = 5000;

/**
 * Urban Life hero carousel: autoplays every 5s and supports manual
 * selection via the dots, matching the original React component's
 * setInterval(next, 5000) behaviour.
 *
 * @typedef {object} Refs
 * @property {HTMLElement[]} slides
 * @property {HTMLButtonElement[]} dots
 *
 * @extends {Component<Refs>}
 */
class UlHeroComponent extends Component {
  requiredRefs = ['slides'];

  /** @type {number} */
  #current = 0;
  /** @type {number | undefined} */
  #intervalId;

  connectedCallback() {
    super.connectedCallback();

    if (this.refs.slides.length > 1) {
      this.#intervalId = window.setInterval(() => this.#next(), AUTOPLAY_INTERVAL_MS);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    if (this.#intervalId !== undefined) window.clearInterval(this.#intervalId);
  }

  /**
   * Bound declaratively via on:click on each dot in sections/ul-hero.liquid.
   * @param {string} index
   * @param {Event} event
   */
  select(index, event) {
    this.#goTo(Number(index));
  }

  #next() {
    this.#goTo((this.#current + 1) % this.refs.slides.length);
  }

  /** @param {number} index */
  #goTo(index) {
    this.#current = index;

    this.refs.slides.forEach((slide, i) => {
      const active = i === index;
      slide.classList.toggle('ul-hero__slide--active', active);
      slide.setAttribute('aria-hidden', active ? 'false' : 'true');
    });

    (this.refs.dots ?? []).forEach((dot, i) => {
      const active = i === index;
      dot.classList.toggle('ul-hero__dot--active', active);
      dot.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }
}

if (!customElements.get('ul-hero-component')) {
  customElements.define('ul-hero-component', UlHeroComponent);
}
