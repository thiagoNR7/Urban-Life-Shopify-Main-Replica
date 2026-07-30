import { Component } from '@theme/component';
import { trapFocus, removeTrapFocus } from '@theme/focus';

/**
 * Must stay in sync with the `900px` breakpoint hardcoded in the
 * { % stylesheet % } block of sections/ul-header.liquid (extracted from
 * frontend/css/style.css, where the hamburger appears and the desktop
 * menu/CTA disappear). CSS custom properties cannot be read inside a
 * media query condition, so this value cannot be shared with a --ul-
 * token and must be updated in both places if it ever changes.
 */
const DESKTOP_BREAKPOINT = '(min-width: 901px)';

/**
 * Urban Life header: hamburger button + full-screen mobile overlay menu.
 *
 * Visual behaviour (slide via transform, 0.4s, original .menu-mobile /
 * .ativo classes from frontend/css/style.css) is preserved. This class
 * only adds the keyboard/focus/scroll-lock behaviour requested for the
 * migration: aria-expanded, Escape to close, focus trap while open,
 * scroll lock, and focus return to the trigger button on close.
 *
 * @typedef {object} Refs
 * @property {HTMLButtonElement} hamburger
 * @property {HTMLDivElement} mobileMenu
 *
 * @extends {Component<Refs>}
 */
class UlHeaderComponent extends Component {
  requiredRefs = ['hamburger', 'mobileMenu'];

  /** @type {string} */
  #previousBodyOverflow = '';
  /** @type {string} */
  #previousBodyPosition = '';
  /** @type {string} */
  #previousBodyTop = '';
  /** @type {string} */
  #previousBodyWidth = '';
  /** @type {number} */
  #scrollPosition = 0;

  /** @type {MediaQueryList | undefined} */
  #desktopMediaQuery;

  connectedCallback() {
    super.connectedCallback();

    this.addEventListener('keydown', this.#onKeyDown);
    this.refs.mobileMenu.addEventListener('click', this.#onMobileMenuClick);

    this.#desktopMediaQuery = window.matchMedia(DESKTOP_BREAKPOINT);
    this.#desktopMediaQuery.addEventListener('change', this.#onBreakpointChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    this.removeEventListener('keydown', this.#onKeyDown);
    this.refs.mobileMenu.removeEventListener('click', this.#onMobileMenuClick);
    this.#desktopMediaQuery?.removeEventListener('change', this.#onBreakpointChange);

    if (this.isOpen) this.#unlockScroll();
  }

  /**
   * @returns {boolean} Whether the mobile overlay menu is open.
   */
  get isOpen() {
    return this.refs.hamburger.getAttribute('aria-expanded') === 'true';
  }

  /**
   * Toggles the mobile overlay menu. Bound declaratively via on:click on
   * the hamburger button in sections/ul-header.liquid.
   */
  toggleMenu() {
    if (this.isOpen) {
      this.closeMenu();
    } else {
      this.openMenu();
    }
  }

  openMenu() {
    const { hamburger, mobileMenu } = this.refs;

    hamburger.setAttribute('aria-expanded', 'true');
    hamburger.setAttribute('aria-label', 'Fechar menu');
    mobileMenu.removeAttribute('inert');
    mobileMenu.setAttribute('aria-hidden', 'false');
    mobileMenu.classList.add('ul-header__mobile-menu--open');

    this.#lockScroll();
    trapFocus(mobileMenu);
  }

  /**
   * @param {{ returnFocus?: boolean }} [options]
   */
  closeMenu(options) {
    const returnFocus = options?.returnFocus ?? true;
    const { hamburger, mobileMenu } = this.refs;

    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.setAttribute('aria-label', 'Abrir menu');
    mobileMenu.classList.remove('ul-header__mobile-menu--open');
    mobileMenu.setAttribute('aria-hidden', 'true');
    mobileMenu.setAttribute('inert', '');

    removeTrapFocus();
    this.#unlockScroll();

    if (returnFocus) hamburger.focus();
  }

  /**
   * Closes the menu on Escape, matching the requirement that the overlay
   * is keyboard-dismissible. The original project had no keyboard handling
   * for the mobile menu at all.
   * @param {KeyboardEvent} event
   */
  #onKeyDown = (event) => {
    if (event.key !== 'Escape' || !this.isOpen) return;

    event.preventDefault();
    this.closeMenu();
  };

  /**
   * Closes the menu when a link or the account button inside it is
   * activated, matching main.js's original behaviour for .menu-mobile
   * (closes on click of any `a, button` inside).
   * @param {MouseEvent} event
   */
  #onMobileMenuClick = (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('a, button')) this.closeMenu();
  };

  /**
   * If the viewport crosses into desktop width while the overlay is open,
   * the hamburger that triggered it becomes hidden (display: none) by the
   * 900px breakpoint. Without this, the menu would stay open, scroll-locked
   * and focus-trapped, with no visible way to close it other than Escape.
   * Focus is not returned to the hamburger here since it is no longer
   * visible/focusable at this viewport width.
   * @param {MediaQueryListEvent} event
   */
  #onBreakpointChange = (event) => {
    if (event.matches && this.isOpen) this.closeMenu({ returnFocus: false });
  };

  /**
   * Locks background scroll while the overlay is open. Uses position:fixed
   * (in addition to overflow:hidden) and restores the exact scroll offset
   * on unlock, since overflow:hidden alone does not reliably prevent
   * background scroll/rubber-banding on iOS Safari.
   */
  #lockScroll() {
    this.#scrollPosition = window.scrollY;

    this.#previousBodyOverflow = document.body.style.overflow;
    this.#previousBodyPosition = document.body.style.position;
    this.#previousBodyTop = document.body.style.top;
    this.#previousBodyWidth = document.body.style.width;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${this.#scrollPosition}px`;
    document.body.style.width = '100%';
  }

  #unlockScroll() {
    document.body.style.overflow = this.#previousBodyOverflow;
    document.body.style.position = this.#previousBodyPosition;
    document.body.style.top = this.#previousBodyTop;
    document.body.style.width = this.#previousBodyWidth;

    window.scrollTo(0, this.#scrollPosition);
  }
}

if (!customElements.get('ul-header-component')) {
  customElements.define('ul-header-component', UlHeaderComponent);
}
