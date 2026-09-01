import { Component } from '@theme/component';

/**
 * Alterna qual painel de tamanho (P/M/G) fica visivel dentro de um card de
 * cesta da vitrine multiprodutor (Etapa 4 - Urban Life). Mesma logica de
 * `#activate` de assets/ul-weekly-basket-selector.js (troca aria-selected/
 * tabindex/hidden), sem add-to-cart nem troca de item: este card e so
 * descoberta, a compra de verdade acontece na pagina do produtor.
 *
 * @typedef {object} BasketCardRefs
 * @property {HTMLButtonElement[]} tabs
 * @property {HTMLElement[]} panels
 *
 * @extends {Component<BasketCardRefs>}
 */
class UlMarketplaceBasketCardComponent extends Component {
  requiredRefs = ['tabs', 'panels'];

  /**
   * Bound via on:click="/select/{size}" em cada chip P/M/G.
   * @param {string} size
   */
  select(size) {
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

/**
 * Barra de filtros + ordenacao + grade da vitrine multiprodutor. Filtra e
 * ordena inteiramente no navegador (sem fetch, sem backend) sobre os cards
 * ja renderizados no servidor, lendo os `data-*` que
 * snippets/ul-marketplace-basket-card.liquid e
 * snippets/ul-marketplace-product-card.liquid gravam em cada card a partir
 * dos metafields reais do produto/produtor - mesmo espirito de
 * assets/ul-producers.js (diretorio de produtores).
 *
 * @typedef {object} GridRefs
 * @property {HTMLElement[]} [cards]
 * @property {HTMLButtonElement[]} [tipoChips]
 * @property {HTMLButtonElement[]} [sizeChips]
 * @property {HTMLSelectElement} [producerSelect]
 * @property {HTMLInputElement} [availabilityCheckbox]
 * @property {HTMLSelectElement} [sortSelect]
 * @property {HTMLElement} counter
 * @property {HTMLElement} emptyState
 * @property {HTMLElement} [drawer]
 * @property {HTMLButtonElement} [filtersToggle]
 *
 * @extends {Component<GridRefs>}
 */
class UlMarketplaceGridComponent extends Component {
  requiredRefs = ['counter', 'emptyState'];

  #tipoFilter = 'all';
  #producerFilter = '';
  #sizeFilter = '';
  #onlyAvailable = false;

  connectedCallback() {
    super.connectedCallback();
    this.#applyFilters();
  }

  /** Bound via on:click="/setTipo/{value}" nos chips "Todos/Cestas/Produtos da Horta". @param {string} value */
  setTipo(value) {
    this.#tipoFilter = value;
    this.#syncChips(this.refs.tipoChips, 'tipoFilter', value);
    this.#applyFilters();
  }

  /** Bound via on:click="/setSize/{value}" nos chips P/M/G. @param {string} value */
  setSize(value) {
    this.#sizeFilter = value;
    this.#syncChips(this.refs.sizeChips, 'sizeFilter', value);
    this.#applyFilters();
  }

  /** Bound via on:click="/clearSizeFilter" no chip "Todos os tamanhos". */
  clearSizeFilter() {
    this.setSize('');
  }

  /** Bound via on:change="/onProducerChange" no select de produtor. */
  onProducerChange() {
    this.#producerFilter = this.refs.producerSelect?.value ?? '';
    this.#applyFilters();
  }

  /** Bound via on:change="/onAvailabilityChange" no checkbox de disponibilidade. */
  onAvailabilityChange() {
    this.#onlyAvailable = this.refs.availabilityCheckbox?.checked ?? false;
    this.#applyFilters();
  }

  /** Bound via on:change="/onSortChange" no select de ordenacao. */
  onSortChange() {
    this.#applySort();
  }

  /** Bound via on:click="/clearFilters" no botao "Limpar filtros". */
  clearFilters() {
    this.#tipoFilter = 'all';
    this.#producerFilter = '';
    this.#sizeFilter = '';
    this.#onlyAvailable = false;

    this.#syncChips(this.refs.tipoChips, 'tipoFilter', 'all');
    this.#syncChips(this.refs.sizeChips, 'sizeFilter', '');
    if (this.refs.producerSelect) this.refs.producerSelect.value = '';
    if (this.refs.availabilityCheckbox) this.refs.availabilityCheckbox.checked = false;
    if (this.refs.sortSelect) this.refs.sortSelect.value = 'relevance';

    this.#applyFilters();
    this.#applySort();
  }

  /** Bound via on:click="/openDrawer" no botao "Filtros" (mobile). */
  openDrawer() {
    const drawer = this.refs.drawer;
    if (!drawer) return;
    drawer.hidden = false;
    this.refs.filtersToggle?.setAttribute('aria-expanded', 'true');
    /** @type {HTMLElement | null} */ (drawer.querySelector('[data-drawer-close]'))?.focus();
  }

  /** Bound via on:click="/closeDrawer" no backdrop e no X do drawer (mobile). */
  closeDrawer() {
    const drawer = this.refs.drawer;
    if (!drawer) return;
    drawer.hidden = true;
    this.refs.filtersToggle?.setAttribute('aria-expanded', 'false');
    this.refs.filtersToggle?.focus();
  }

  /** Bound via on:keydown="/onDrawerKeydown" no proprio drawer (fecha com Esc). @param {KeyboardEvent} event */
  onDrawerKeydown(event) {
    if (event.key === 'Escape') this.closeDrawer();
  }

  /**
   * @param {HTMLButtonElement[] | undefined} chips
   * @param {string} datasetKey
   * @param {string} value
   */
  #syncChips(chips, datasetKey, value) {
    (chips ?? []).forEach((chip) => {
      const active = (chip.dataset[datasetKey] ?? '') === value;
      chip.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  #applyFilters() {
    const cards = this.refs.cards ?? [];
    let visibleCount = 0;

    for (const card of cards) {
      const tipo = card.dataset.tipo ?? '';
      const producer = card.dataset.producer ?? '';
      const available = card.dataset.available === 'true';
      const sizes = (card.dataset.sizes ?? '').trim().split(/\s+/).filter(Boolean);

      const matchesTipo = this.#tipoFilter === 'all' || tipo === this.#tipoFilter;
      const matchesProducer = this.#producerFilter === '' || producer === this.#producerFilter;
      const matchesAvailability = !this.#onlyAvailable || available;
      const matchesSize = this.#sizeFilter === '' || sizes.includes(this.#sizeFilter);

      const visible = matchesTipo && matchesProducer && matchesAvailability && matchesSize;
      card.hidden = !visible;
      if (visible) visibleCount += 1;
    }

    this.refs.counter.textContent =
      visibleCount === 1 ? '1 produto encontrado' : `${visibleCount} produtos encontrados`;
    this.refs.emptyState.hidden = visibleCount !== 0 || cards.length === 0;
  }

  #applySort() {
    const sortValue = this.refs.sortSelect?.value ?? 'relevance';
    const cards = this.refs.cards ?? [];

    cards.forEach((card, index) => {
      if (sortValue === 'relevance') {
        card.style.order = '';
        return;
      }

      const price = Number(card.dataset.price ?? 0);
      // Empata por ordem original (index) para manter um resultado estavel
      // quando 2+ cards tem o mesmo preco.
      const rank = sortValue === 'price-asc' ? price * 100000 + index : -price * 100000 + index;
      card.style.order = String(rank);
    });
  }
}

if (!customElements.get('ul-marketplace-basket-card-component')) {
  customElements.define('ul-marketplace-basket-card-component', UlMarketplaceBasketCardComponent);
}

if (!customElements.get('ul-marketplace-grid-component')) {
  customElements.define('ul-marketplace-grid-component', UlMarketplaceGridComponent);
}
