import { Component } from '@theme/component';

/**
 * Seletor de tamanho de cesta (P/M/G) da "Selecao da semana", no perfil
 * do produtor (Etapa 3.8 - Urban Life). Os 3 paineis completos (titulo,
 * preco, disponibilidade, itens, link) ja vem prontos do Liquid - este
 * componente so alterna qual painel fica visivel (`hidden`) e mantem
 * aria-selected/tabindex em sincronia. Nao conhece nomes de produto nem
 * de alimento, entao funciona igual para qualquer produtor.
 *
 * @typedef {object} Refs
 * @property {HTMLButtonElement[]} tabs
 * @property {HTMLElement[]} panels
 *
 * @extends {Component<Refs>}
 */
class UlWeeklyBasketSelectorComponent extends Component {
  requiredRefs = ['tabs', 'panels'];

  /**
   * Bound declaratively via on:click="/select/{size}" on each tab.
   * @param {string} size
   */
  select(size) {
    this.#activate(size);
  }

  /** @param {KeyboardEvent} event */
  onKeydown(event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

    const tabs = this.refs.tabs;
    const currentIndex = tabs.indexOf(/** @type {HTMLButtonElement} */ (document.activeElement));
    if (currentIndex === -1) return;

    event.preventDefault();

    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const nextTab = tabs[(currentIndex + delta + tabs.length) % tabs.length];
    const size = nextTab?.dataset.size;
    if (!size) return;

    nextTab.focus();
    this.#activate(size);
  }

  /** @param {string} size */
  #activate(size) {
    this.refs.tabs.forEach((tab) => {
      const active = tab.dataset.size === size;
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
      tab.tabIndex = active ? 0 : -1;
    });

    this.refs.panels.forEach((panel) => {
      panel.hidden = panel.dataset.size !== size;
    });
  }
}

if (!customElements.get('ul-weekly-basket-selector-component')) {
  customElements.define('ul-weekly-basket-selector-component', UlWeeklyBasketSelectorComponent);
}
