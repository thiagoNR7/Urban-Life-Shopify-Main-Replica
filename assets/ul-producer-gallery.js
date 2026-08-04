import { Component } from '@theme/component';

const AUTOPLAY_INTERVAL = 1000;

/**
 * Carrossel leve do perfil do produtor (Etapa 3.12 - Urban Life).
 * Navegacao via scroll nativo com scroll-snap (setas/dots/autoplay
 * chamam `track.scrollTo({ left, behavior })` - NUNCA
 * `slide.scrollIntoView(...)`, que mesmo com block:'nearest' pode
 * arrastar o scroll vertical da PAGINA inteira, nao so do carrossel).
 * O slide ativo tambem e sincronizado via IntersectionObserver, entao
 * dots/setas continuam corretos mesmo quando o usuario arrasta/faz
 * swipe direto no carrossel. Nenhum foco programatico e disparado pelo
 * autoplay nem pela troca manual de slide.
 *
 * Autoplay: avanca automaticamente a cada 1s (com loop, volta para o
 * primeiro slide depois do ultimo). Pausa enquanto o mouse esta sobre o
 * carrossel, enquanto um controle do carrossel esta com foco, ou
 * enquanto a aba do navegador esta oculta - e retoma quando nenhuma
 * dessas condicoes mais se aplica. Clique em seta/indicador reinicia a
 * contagem de 1s. So existe com mais de 1 slide e so se
 * prefers-reduced-motion NAO estiver ativo (nesse caso a navegacao
 * manual continua funcionando normalmente, so o avanco automatico fica
 * desligado). Um unico setInterval por instancia, sempre limpo em
 * disconnectedCallback.
 *
 * @typedef {object} Refs
 * @property {HTMLElement} track
 * @property {HTMLElement[]} slides
 * @property {HTMLButtonElement[]} [dots]
 * @property {HTMLButtonElement} [prevButton]
 * @property {HTMLButtonElement} [nextButton]
 *
 * @extends {Component<Refs>}
 */
class UlProducerGalleryComponent extends Component {
  requiredRefs = ['track', 'slides'];

  /** @type {number} */
  #activeIndex = 0;
  /** @type {IntersectionObserver | undefined} */
  #observer;
  /** @type {number | undefined} */
  #autoplayId;
  /** @type {Set<'hover' | 'focus' | 'hidden'>} */
  #pauseReasons = new Set();
  /** @type {MediaQueryList | undefined} */
  #reducedMotionQuery;
  /** @type {(() => void) | undefined} */
  #boundVisibilityChange;

  connectedCallback() {
    super.connectedCallback();

    if (this.refs.slides.length <= 1) return;

    this.#observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (!visible) return;

        const index = this.refs.slides.indexOf(/** @type {HTMLElement} */ (visible.target));
        if (index !== -1) this.#setActive(index);
      },
      { root: this.refs.track, threshold: 0.6 }
    );

    for (const slide of this.refs.slides) {
      this.#observer.observe(slide);
    }

    this.#setActive(0);

    this.#reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (this.#reducedMotionQuery.matches) return;

    this.addEventListener('mouseenter', this.#onMouseEnter);
    this.addEventListener('mouseleave', this.#onMouseLeave);
    this.addEventListener('focusin', this.#onFocusIn);
    this.addEventListener('focusout', this.#onFocusOut);

    this.#boundVisibilityChange = () => this.#onVisibilityChange();
    document.addEventListener('visibilitychange', this.#boundVisibilityChange);

    // Sincroniza o estado inicial de pausa (aba pode ja abrir oculta) e,
    // se nada estiver pausando, inicia o autoplay.
    this.#onVisibilityChange();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#observer?.disconnect();
    this.#stopAutoplay();

    if (this.#boundVisibilityChange) {
      document.removeEventListener('visibilitychange', this.#boundVisibilityChange);
    }
  }

  prev() {
    this.#goTo(this.#activeIndex - 1);
    this.#restartAutoplay();
  }

  next() {
    this.#goTo(this.#activeIndex + 1);
    this.#restartAutoplay();
  }

  /** @param {string} index */
  select(index) {
    this.#goTo(Number(index));
    this.#restartAutoplay();
  }

  /** @param {KeyboardEvent} event */
  onKeydown(event) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.prev();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.next();
    }
  }

  #onMouseEnter = () => this.#pause('hover');
  #onMouseLeave = () => this.#resume('hover');
  #onFocusIn = () => this.#pause('focus');
  #onFocusOut = () => this.#resume('focus');

  #onVisibilityChange() {
    if (document.hidden) {
      this.#pause('hidden');
    } else {
      this.#resume('hidden');
    }
  }

  /** @param {'hover' | 'focus' | 'hidden'} reason */
  #pause(reason) {
    this.#pauseReasons.add(reason);
    this.#stopAutoplay();
  }

  /** @param {'hover' | 'focus' | 'hidden'} reason */
  #resume(reason) {
    this.#pauseReasons.delete(reason);
    if (this.#pauseReasons.size === 0) this.#startAutoplay();
  }

  #startAutoplay() {
    if (this.#autoplayId !== undefined) return;
    if (this.#pauseReasons.size > 0) return;
    if (this.#reducedMotionQuery?.matches) return;

    this.#autoplayId = window.setInterval(() => {
      this.#goTo(this.#activeIndex + 1, true);
    }, AUTOPLAY_INTERVAL);
  }

  #stopAutoplay() {
    if (this.#autoplayId === undefined) return;
    window.clearInterval(this.#autoplayId);
    this.#autoplayId = undefined;
  }

  #restartAutoplay() {
    this.#stopAutoplay();
    this.#startAutoplay();
  }

  /**
   * @param {number} index
   * @param {boolean} [wrap] - true no avanco automatico (volta ao inicio); false na navegacao manual (trava nas pontas).
   */
  #goTo(index, wrap = false) {
    const count = this.refs.slides.length;
    const targetIndex = wrap ? (index + count) % count : Math.max(0, Math.min(index, count - 1));
    const slide = this.refs.slides[targetIndex];
    if (!slide) return;

    const reducedMotion = this.#reducedMotionQuery?.matches ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // scrollTo no proprio track (nunca scrollIntoView no slide): scrollIntoView
    // pode ajustar o scroll vertical do documento inteiro para tentar trazer o
    // elemento "para a vista", mesmo com block:'nearest' - foi isso que fazia a
    // pagina pular durante o autoplay. scrollTo aplicado diretamente ao
    // container scrollavel do carrossel so move a faixa horizontal de imagens,
    // sem tocar em window.scrollY.
    this.refs.track.scrollTo({
      left: slide.offsetLeft,
      behavior: reducedMotion ? 'auto' : 'smooth',
    });

    this.#setActive(targetIndex);
  }

  /** @param {number} index */
  #setActive(index) {
    this.#activeIndex = index;

    this.refs.slides.forEach((slide, i) => {
      slide.setAttribute('aria-hidden', i === index ? 'false' : 'true');
    });

    (this.refs.dots ?? []).forEach((dot, i) => {
      const active = i === index;
      dot.classList.toggle('is-active', active);
      if (active) {
        dot.setAttribute('aria-current', 'true');
      } else {
        dot.removeAttribute('aria-current');
      }
    });

    if (this.refs.prevButton) this.refs.prevButton.disabled = index === 0;
    if (this.refs.nextButton) this.refs.nextButton.disabled = index === this.refs.slides.length - 1;
  }
}

if (!customElements.get('ul-producer-gallery-component')) {
  customElements.define('ul-producer-gallery-component', UlProducerGalleryComponent);
}
