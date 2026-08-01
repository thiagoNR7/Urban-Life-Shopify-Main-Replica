import { Component } from '@theme/component';

/**
 * Diretorio de produtores (Etapa 2 - Urban Life): busca por nome/horta/bairro,
 * filtro por bairro, filtro por cultivo e checkbox "Agroecologico", tudo em
 * JavaScript puro no navegador (sem backend), lendo os `data-*` que
 * snippets/ul-producer-card.liquid grava em cada card a partir dos campos do
 * metaobject `produtor`.
 *
 * @typedef {object} Refs
 * @property {HTMLInputElement} searchInput
 * @property {HTMLSelectElement} bairroSelect
 * @property {HTMLSelectElement} cultivoSelect
 * @property {HTMLInputElement} agroCheckbox
 * @property {HTMLButtonElement} clearButton
 * @property {HTMLElement} counter
 * @property {HTMLElement} emptyState
 * @property {HTMLElement[]} [cards]
 *
 * @extends {Component<Refs>}
 */
class UlProducerDirectoryComponent extends Component {
  requiredRefs = ['searchInput', 'bairroSelect', 'cultivoSelect', 'agroCheckbox', 'counter', 'emptyState'];

  /**
   * Reaplica os filtros combinados (busca + bairro + cultivo + agroecologico)
   * sobre os cards ja renderizados no servidor. So ha 3 produtores no MVP,
   * entao um passe simples por todos os cards a cada evento e suficiente
   * (sem debounce, sem paginacao, sem fetch).
   */
  filter = () => {
    const cards = this.refs.cards ?? [];
    const query = this.#normalize(this.refs.searchInput.value.trim());
    const bairro = this.refs.bairroSelect.value;
    const cultivo = this.refs.cultivoSelect.value;
    const onlyAgro = this.refs.agroCheckbox.checked;

    let visibleCount = 0;

    for (const card of cards) {
      const name = this.#normalize(card.dataset.name ?? '');
      const horta = this.#normalize(card.dataset.horta ?? '');
      const cardBairro = card.dataset.bairro ?? '';
      const cultivos = (card.dataset.cultivos ?? '').split('|').filter(Boolean);
      const isAgro = card.dataset.agroecologico === 'true';

      const matchesQuery =
        query === '' || name.includes(query) || horta.includes(query) || this.#normalize(cardBairro).includes(query);
      const matchesBairro = bairro === '' || cardBairro === bairro;
      const matchesCultivo = cultivo === '' || cultivos.includes(cultivo);
      const matchesAgro = !onlyAgro || isAgro;

      const visible = matchesQuery && matchesBairro && matchesCultivo && matchesAgro;
      card.hidden = !visible;
      if (visible) visibleCount += 1;
    }

    this.refs.counter.textContent =
      visibleCount === 1 ? '1 produtor encontrado' : `${visibleCount} produtores encontrados`;
    this.refs.emptyState.hidden = visibleCount !== 0 || cards.length === 0;
  };

  /**
   * Limpa busca + selects + checkbox e reaplica o filtro (mostra tudo de novo).
   */
  clearFilters = () => {
    this.refs.searchInput.value = '';
    this.refs.bairroSelect.value = '';
    this.refs.cultivoSelect.value = '';
    this.refs.agroCheckbox.checked = false;
    this.filter();
  };

  /**
   * Normaliza texto para comparacao (minusculas, sem acento) para que a busca
   * encontre "Tucuruvi"/"tucuruví" independente de acentuacao/caixa.
   * @param {string} value
   * @returns {string}
   */
  #normalize(value) {
    return value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();
  }
}

if (!customElements.get('ul-producer-directory-component')) {
  customElements.define('ul-producer-directory-component', UlProducerDirectoryComponent);
}
